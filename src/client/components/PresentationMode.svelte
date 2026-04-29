<script lang="ts">
  import { tick } from 'svelte';
  import { fetchFile } from '../services/api';
  import { currentPath } from '../stores/navigation';
  import { renderMarkdown, postProcessElement } from '../utils/markdown-renderer';

  let { isOpen, filePath, onClose }: {
    isOpen: boolean;
    filePath: string;
    onClose: () => void;
  } = $props();

  let revealContainer: HTMLDivElement | undefined = $state();
  let deck: any = null;
  let slidesHtml: string[] = $state([]);
  let ready = $state(false);
  let initCalled = false;
  let exporting = $state(false);

  const REVEAL_HEIGHT = 720;
  const REVEAL_MARGIN = 0.04;
  const USABLE_HEIGHT = REVEAL_HEIGHT * (1 - REVEAL_MARGIN * 2) * 0.85;

  $effect(() => {
    if (isOpen && filePath && !initCalled) {
      initCalled = true;
      initPresentation();
    }
    if (!isOpen && initCalled) {
      cleanup();
      initCalled = false;
    }
  });

  async function initPresentation() {
    ready = false;
    slidesHtml = [];

    try {
      const file = await fetchFile(filePath);
      const dirPath = filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/')) : $currentPath;

      const slides = splitIntoSlides(file.content);

      if (slides.length === 0) {
        slidesHtml = [await renderMarkdown(file.content, dirPath)];
      } else {
        slidesHtml = await Promise.all(
          slides.map((slide: string) => renderMarkdown(slide, dirPath))
        );
      }
      ready = true;

      await tick();
      await new Promise(r => requestAnimationFrame(r));

      if (!revealContainer || !isOpen) return;

      splitOverflowingSlides(revealContainer);

      const Reveal = (await import('reveal.js')).default;
      deck = new Reveal(revealContainer, {
        hash: false,
        embedded: false,
        transition: 'slide',
        backgroundTransition: 'fade',
        controls: true,
        progress: true,
        center: true,
        slideNumber: 'h.v',
        touch: true,
        keyboard: true,
        overview: true,
        width: 1280,
        height: REVEAL_HEIGHT,
        margin: REVEAL_MARGIN,
      });
      await deck.initialize();

      await postProcessElement(revealContainer);

      markScrollableSlides(revealContainer);
      setupScrollInterception(revealContainer);

      deck.on('slidechanged', () => {
        if (revealContainer) {
          postProcessElement(revealContainer);
          const scrollables = revealContainer.querySelectorAll('.scrollable-slide');
          for (const el of scrollables) {
            el.scrollTop = 0;
          }
          const hints = revealContainer.querySelectorAll('.scroll-hint');
          for (const hint of hints) {
            hint.remove();
          }
        }
      });
    } catch (err) {
      console.error('Failed to initialize presentation:', err);
    }
  }

  function splitOverflowingSlides(container: HTMLDivElement) {
    const slidesWrapper = container.querySelector('.slides');
    if (!slidesWrapper) return;

    const sections = Array.from(slidesWrapper.querySelectorAll(':scope > section'));

    for (const section of sections) {
      const contentHeight = section.scrollHeight;
      if (contentHeight <= USABLE_HEIGHT) continue;

      const children = Array.from(section.childNodes);
      if (children.length <= 1) continue;

      const verticalGroup = document.createElement('section');
      let currentSubSlide = document.createElement('section');
      currentSubSlide.className = 'markdown-body';
      let currentHeight = 0;

      const measurer = document.createElement('div');
      measurer.style.cssText = 'position:absolute;visibility:hidden;width:100%;';
      section.appendChild(measurer);

      for (const child of children) {
        if (child === measurer) continue;
        measurer.appendChild(child);
        const childHeight = measurer.scrollHeight;
        measurer.removeChild(child);

        const isBlockBreakpoint = child instanceof HTMLElement && /^(H[1-6]|PRE|TABLE|BLOCKQUOTE|UL|OL|HR|DIV)$/.test(child.tagName);

        if (currentHeight > 0 && currentHeight + childHeight > USABLE_HEIGHT && isBlockBreakpoint) {
          verticalGroup.appendChild(currentSubSlide);
          currentSubSlide = document.createElement('section');
          currentSubSlide.className = 'markdown-body';
          currentHeight = 0;
        }

        currentSubSlide.appendChild(child);
        currentHeight += childHeight;
      }

      section.removeChild(measurer);

      if (currentSubSlide.childNodes.length > 0) {
        verticalGroup.appendChild(currentSubSlide);
      }

      if (verticalGroup.querySelectorAll('section').length > 1) {
        slidesWrapper.replaceChild(verticalGroup, section);
      } else {
        while (verticalGroup.firstChild) {
          const sub = verticalGroup.firstChild;
          verticalGroup.removeChild(sub);
          slidesWrapper.replaceChild(sub, section);
        }
      }
    }
  }

  function markScrollableSlides(container: HTMLDivElement) {
    const sections = container.querySelectorAll('.slides section');
    for (const section of sections) {
      if (section.scrollHeight > section.clientHeight + 10) {
        section.classList.add('scrollable-slide');
        const hint = document.createElement('div');
        hint.className = 'scroll-hint';
        hint.textContent = '\u2193 Scroll for more';
        section.appendChild(hint);
      }
    }
  }

  function setupScrollInterception(container: HTMLDivElement) {
    container.addEventListener('wheel', (e: WheelEvent) => {
      const target = e.target as HTMLElement;
      const scrollable = target.closest('.scrollable-slide') as HTMLElement | null;
      if (!scrollable) return;

      const atTop = scrollable.scrollTop <= 0 && e.deltaY < 0;
      const atBottom = scrollable.scrollTop + scrollable.clientHeight >= scrollable.scrollHeight - 1 && e.deltaY > 0;

      if (!atTop && !atBottom) {
        e.stopPropagation();
      }
    }, { capture: true });
  }

  function cleanup() {
    if (deck) {
      try { deck.destroy(); } catch {}
      deck = null;
    }
    slidesHtml = [];
    ready = false;
  }

  function splitIntoSlides(content: string): string[] {
    const lines = content.split('\n');
    const slides: string[] = [];
    let current: string[] = [];
    let inCodeFence = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^(`{3,}|~{3,})/.test(line.trimStart())) {
        inCodeFence = !inCodeFence;
      }
      if (!inCodeFence && /^(?:---+|\*\*\*+|___+)\s*$/.test(line) && current.length > 0) {
        slides.push(current.join('\n').trim());
        current = [];
      } else {
        current.push(line);
      }
    }
    if (current.length > 0) {
      const text = current.join('\n').trim();
      if (text) slides.push(text);
    }
    return slides;
  }

  function getExportFilename(): string {
    const name = filePath.split('/').pop()?.replace(/\.md$/i, '') || 'slides';
    return name;
  }

  async function proxyExternalImages(container: HTMLElement): Promise<Map<HTMLImageElement, string>> {
    const originals = new Map<HTMLImageElement, string>();
    const imgs = Array.from(container.querySelectorAll('img'));
    const origin = window.location.origin;

    await Promise.all(imgs.map(async (img) => {
      const src = img.src;
      if (!src || src.startsWith('data:') || src.startsWith(origin)) return;
      try {
        const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(src)}`;
        const resp = await fetch(proxyUrl);
        if (!resp.ok) return;
        const blob = await resp.blob();
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
        originals.set(img, src);
        img.src = dataUrl;
      } catch {}
    }));
    return originals;
  }

  function restoreImages(originals: Map<HTMLImageElement, string>) {
    for (const [img, src] of originals) {
      img.src = src;
    }
  }

  async function exportAsPng() {
    if (!deck || !revealContainer || exporting) return;

    exporting = true;
    let proxiedImages = new Map<HTMLImageElement, string>();
    try {
      const { toPng } = await import('html-to-image');
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      proxiedImages = await proxyExternalImages(revealContainer);

      const savedState = deck.getState();
      const horizontalSlides = deck.getHorizontalSlides() as HTMLElement[];

      const toolbar = document.querySelector('.presentation-toolbar') as HTMLElement;
      const exportOverlay = document.querySelector('.export-overlay') as HTMLElement;
      if (toolbar) toolbar.style.display = 'none';

      const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim() || '#282c34';

      const toPngOptions = {
        backgroundColor: bgColor,
        pixelRatio: 2,
        imagePlaceholder: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAAA0lEQVQI12P4z8BQDwAEgAF/QualzQAAAABJRU5ErkJggg==',
        filter: (node: HTMLElement) => {
          if (!node.classList) return true;
          return !node.classList.contains('presentation-toolbar') && !node.classList.contains('export-overlay');
        },
      };

      let slideIndex = 0;
      for (let h = 0; h < horizontalSlides.length; h++) {
        const hSlide = horizontalSlides[h];
        const verticalSlides = hSlide.querySelectorAll(':scope > section');

        if (verticalSlides.length > 0) {
          for (let v = 0; v < verticalSlides.length; v++) {
            deck.slide(h, v);
            await new Promise(r => setTimeout(r, 500));
            const dataUrl = await toPng(revealContainer, toPngOptions);
            const base64 = dataUrl.split(',')[1];
            zip.file(`slide-${String(slideIndex + 1).padStart(3, '0')}.png`, base64, { base64: true });
            slideIndex++;
          }
        } else {
          deck.slide(h, 0);
          await new Promise(r => setTimeout(r, 500));
          const dataUrl = await toPng(revealContainer, toPngOptions);
          const base64 = dataUrl.split(',')[1];
          zip.file(`slide-${String(slideIndex + 1).padStart(3, '0')}.png`, base64, { base64: true });
          slideIndex++;
        }
      }

      if (toolbar) toolbar.style.display = '';
      deck.setState(savedState);

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${getExportFilename()}-slides.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export slides as PNG:', err);
    } finally {
      restoreImages(proxiedImages);
      exporting = false;
    }
  }

  function exportAsPdf() {
    window.print();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!isOpen) return;
    if (e.key === 'q') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
  <div class="presentation-overlay">
    <div class="presentation-toolbar">
      <button class="toolbar-btn" onclick={exportAsPng} title="Export slides as PNG" disabled={exporting}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
      </button>
      <button class="toolbar-btn" onclick={exportAsPdf} title="Export as PDF (Print)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
      </button>
      <button class="toolbar-btn" onclick={onClose} title="Exit presentation (Q)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    {#if exporting}
      <div class="export-overlay">
        <div class="export-overlay-content">
          <div class="export-spinner"></div>
          <span>Exporting slides...</span>
        </div>
      </div>
    {/if}
    {#if ready && slidesHtml.length > 0}
      <div class="reveal" bind:this={revealContainer}>
        <div class="slides">
          {#each slidesHtml as slide}
            <section class="markdown-body">{@html slide}</section>
          {/each}
        </div>
      </div>
    {:else}
      <div class="presentation-loading">Loading presentation...</div>
    {/if}
  </div>
{/if}

<style>
  .presentation-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: var(--bg-primary);
  }

  .presentation-toolbar {
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: 1001;
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .toolbar-btn {
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    color: var(--text-primary);
    width: 36px;
    height: 36px;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.7;
    transition: opacity 0.15s;
  }

  .toolbar-btn:hover:not(:disabled) {
    opacity: 1;
  }

  .toolbar-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .export-overlay {
    position: fixed;
    inset: 0;
    z-index: 1002;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .export-overlay-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    color: var(--text-primary);
    font-size: 18px;
  }

  .export-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--border);
    border-top-color: var(--accent-blue);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .presentation-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-secondary);
    font-size: 18px;
  }

  :global(.presentation-overlay .reveal) {
    height: 100%;
    width: 100%;
  }

  :global(.presentation-overlay .reveal .slides) {
    text-align: left;
  }

  :global(.presentation-overlay .reveal .slides section) {
    text-align: left;
  }

  :global(.reveal) {
    background: var(--bg-primary) !important;
    color: var(--text-primary);
  }

  :global(.reveal h1),
  :global(.reveal h2),
  :global(.reveal h3),
  :global(.reveal h4),
  :global(.reveal h5),
  :global(.reveal h6) {
    color: var(--text-heading) !important;
  }

  :global(.reveal a) {
    color: var(--accent-blue) !important;
  }

  :global(.reveal pre code) {
    background: var(--bg-tertiary);
  }

  :global(.reveal .controls) {
    color: var(--accent-blue) !important;
  }

  :global(.reveal .progress) {
    color: var(--accent-blue) !important;
  }

  :global(.reveal .slide-number) {
    color: var(--text-secondary);
    background: var(--bg-secondary);
  }

  :global(.reveal .slides section.scrollable-slide) {
    overflow-y: auto !important;
    max-height: 100%;
  }

  :global(.reveal .slides section.scrollable-slide::-webkit-scrollbar) {
    width: 6px;
  }

  :global(.reveal .slides section.scrollable-slide::-webkit-scrollbar-thumb) {
    background: var(--scrollbar);
    border-radius: 3px;
  }

  :global(.reveal .slides section .scroll-hint) {
    position: absolute;
    bottom: 12px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 12px;
    color: var(--text-secondary);
    opacity: 0.7;
    pointer-events: none;
    animation: scrollHintFade 3s ease-in-out forwards;
  }

  @keyframes scrollHintFade {
    0% { opacity: 0; }
    20% { opacity: 0.7; }
    80% { opacity: 0.7; }
    100% { opacity: 0; }
  }

  :global(.reveal section.markdown-body img) {
    max-width: 100%;
    max-height: 60vh;
  }

  @media print {
    .presentation-toolbar,
    .export-overlay {
      display: none !important;
    }

    .presentation-overlay {
      position: static !important;
      background: white !important;
      z-index: auto !important;
    }

    :global(.app) {
      display: none !important;
    }

    :global(.reveal .controls),
    :global(.reveal .progress),
    :global(.reveal .slide-number) {
      display: none !important;
    }

    :global(.reveal) {
      background: white !important;
      color: black !important;
      height: auto !important;
      overflow: visible !important;
    }

    :global(.reveal .slides) {
      position: static !important;
      width: 100% !important;
      height: auto !important;
      overflow: visible !important;
      transform: none !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      pointer-events: auto !important;
    }

    :global(.reveal .slides > section),
    :global(.reveal .slides > section > section) {
      position: static !important;
      width: 100% !important;
      height: auto !important;
      min-height: auto !important;
      transform: none !important;
      display: block !important;
      opacity: 1 !important;
      visibility: visible !important;
      page-break-after: always;
      box-sizing: border-box;
      padding: 2rem;
      top: 0 !important;
      left: 0 !important;
    }

    :global(.reveal .slides > section:last-child),
    :global(.reveal .slides > section > section:last-child) {
      page-break-after: auto;
    }

    :global(.reveal h1),
    :global(.reveal h2),
    :global(.reveal h3),
    :global(.reveal h4),
    :global(.reveal h5),
    :global(.reveal h6) {
      color: black !important;
    }

    :global(.reveal a) {
      color: #0366d6 !important;
    }

    :global(.reveal pre) {
      border: 1px solid #ddd !important;
      background: #f6f8fa !important;
    }

    :global(.reveal pre code) {
      background: #f6f8fa !important;
      color: black !important;
    }
  }
</style>
