import { Marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js';
import DOMPurify from 'dompurify';
import { getRawFileUrl } from '../services/api';

export function createMarkedInstance(): Marked {
  const marked = new Marked(
    markedHighlight({
      emptyLangClass: 'hljs',
      langPrefix: 'hljs language-',
      highlight(code, lang) {
        const language = hljs.getLanguage(lang) ? lang : 'plaintext';
        return hljs.highlight(code, { language }).value;
      }
    })
  );
  marked.setOptions({ gfm: true, breaks: true });
  return marked;
}

export async function renderMarkdown(md: string, dirPath: string): Promise<string> {
  const normalized = md.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\t/g, '    ');
  const marked = createMarkedInstance();
  const renderer = new marked.Renderer();
  renderer.image = function({ href, title, text }: { href: string; title: string | null; text: string }) {
    if (href && !href.startsWith('http') && !href.startsWith('//')) {
      const imgPath = dirPath === '.' ? href : `${dirPath}/${href}`;
      href = getRawFileUrl(imgPath);
    }
    return `<img src="${href}" alt="${text || ''}" title="${title || ''}" />`;
  };
  const rawHtml = marked.parse(normalized, { renderer }) as string;
  const sanitized = DOMPurify.sanitize(rawHtml, {
    ADD_TAGS: ['table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col'],
    ADD_ATTR: ['colspan', 'rowspan', 'scope', 'align', 'width', 'height', 'style'],
  });
  return sanitized.replace(/<table>/g, '<div class="table-wrapper"><table>').replace(/<\/table>\n?/g, '</table></div>');
}

const COPY_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
const CHECK_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

export function addCopyButtons(container: HTMLElement): void {
  for (const pre of container.querySelectorAll('pre')) {
    if (pre.querySelector('[data-copy-btn]')) continue;
    pre.style.position = 'relative';
    const btn = document.createElement('button');
    btn.setAttribute('data-copy-btn', '');
    // SECURITY: SVG constants are hardcoded static strings, not user input - safe for innerHTML
    btn.innerHTML = COPY_SVG;
    btn.title = 'Copy to clipboard';
    Object.assign(btn.style, {
      position: 'absolute', top: '8px', right: '8px', zIndex: '2',
      background: 'none', border: 'none', padding: '4px', margin: '0',
      cursor: 'pointer', opacity: '0', transition: 'opacity 0.15s',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      lineHeight: '1', color: '#636d83', boxShadow: 'none', outline: 'none',
    });
    pre.addEventListener('mouseenter', () => { btn.style.opacity = '0.6'; });
    pre.addEventListener('mouseleave', () => { btn.style.opacity = '0'; });
    btn.addEventListener('mouseenter', () => { btn.style.opacity = '1'; });
    btn.addEventListener('mouseleave', () => { btn.style.opacity = '0.6'; });
    btn.addEventListener('click', async () => {
      const code = pre.querySelector('code');
      if (!code) return;
      await navigator.clipboard.writeText(code.textContent || '');
      // SECURITY: SVG constants are hardcoded static strings, not user input - safe for innerHTML
      btn.innerHTML = CHECK_SVG;
      btn.style.color = '#98c379';
      setTimeout(() => { btn.innerHTML = COPY_SVG; btn.style.color = '#636d83'; }, 1500);
    });
    pre.appendChild(btn);
  }
}

export async function renderMermaidBlocks(container: HTMLElement): Promise<void> {
  const mermaidBlocks = container.querySelectorAll('code.language-mermaid');
  if (mermaidBlocks.length === 0) return;
  const mermaid = (await import('mermaid')).default;

  const styles = getComputedStyle(document.documentElement);
  const bgPrimary = styles.getPropertyValue('--bg-primary').trim() || '#282c34';
  const bgSecondary = styles.getPropertyValue('--bg-secondary').trim() || '#21252b';
  const bgTertiary = styles.getPropertyValue('--bg-tertiary').trim() || '#2c313a';
  const textPrimary = styles.getPropertyValue('--text-primary').trim() || '#abb2bf';
  const textSecondary = styles.getPropertyValue('--text-secondary').trim() || '#636d83';
  const textHeading = styles.getPropertyValue('--text-heading').trim() || '#e5c07b';
  const border = styles.getPropertyValue('--border').trim() || '#3e4451';

  mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    themeVariables: {
      primaryColor: bgTertiary,
      primaryTextColor: textPrimary,
      primaryBorderColor: border,
      lineColor: textSecondary,
      secondaryColor: bgSecondary,
      tertiaryColor: bgPrimary,
      fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
      fontSize: '14px',
      nodeBorder: border,
      mainBkg: bgTertiary,
      clusterBkg: bgSecondary,
      titleColor: textHeading,
      edgeLabelBackground: bgPrimary,
      nodeTextColor: textPrimary,
    },
  });
  for (const block of mermaidBlocks) {
    const pre = block.parentElement;
    if (!pre) continue;
    const id = `mermaid-${Math.random().toString(36).slice(2)}`;
    try {
      const { svg } = await mermaid.render(id, block.textContent || '');
      const div = document.createElement('div');
      div.className = 'mermaid';
      div.textContent = '';
      // Use SVG profile so DOMPurify preserves <style> tags inside mermaid SVGs;
      // without them, text colors fall back to black and are unreadable on dark backgrounds.
      const sanitizedSvg = DOMPurify.sanitize(svg, {
        USE_PROFILES: { svg: true, svgFilters: true },
        ADD_TAGS: ['style', 'foreignObject'],
      });
      div.appendChild(new DOMParser().parseFromString(sanitizedSvg, 'text/html').body.firstChild!);
      pre.replaceWith(div);
    } catch {
      /* skip invalid diagrams */
    }
  }
}

export async function postProcessElement(container: HTMLElement): Promise<void> {
  addCopyButtons(container);
  await renderMermaidBlocks(container);
}
