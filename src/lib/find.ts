import { StyleMap, toObject } from './style';
import { ApplyTags, PRESERVE_MEDIA_QUERIES } from './config';

/**
 *
 */
export const find = (doc: HTMLElement, tags: ApplyTags): Promise<StyleMap[]> => {
  const promises: Promise<string>[] = [];

  if (doc) {
    let selectors: string[] = [];
    if (tags.link) selectors.push('[rel="stylesheet"]');
    if (tags.style) selectors.push('style');

    doc.querySelectorAll(selectors.join(',')).forEach((el: HTMLElement) => {
      const promise = el.textContent ?
        Promise.resolve(el.textContent) :
        getLinkContent(el as HTMLLinkElement);

      promises.push(promise)
    });
  }

  return Promise.all(promises).then(responses => {
    // if preserve_media_queries is true, create tag style and append to doc
    if (PRESERVE_MEDIA_QUERIES) {
      responses.map(createMediaQueryStyle)
        .filter(style => style)
        .forEach(style => doc.querySelector('head').append(style));
    }

    return responses.map(clearComments)
              .map(clearMediaQueries)
              .map(extract)
              .reduce((acc, cur) => acc.concat(cur), [])
              .filter(style => style)
  });
}

/**
 *
 */
const createMediaQueryStyle = (content: string) => {
  const queries = content.match(/@media[^{]+\{([\s\S]+?\})\s*\}/g);
  if (queries) {
    const element = document.createElement('style');
    element.setAttribute('rel', 'stylesheet');
    element.setAttribute('type', 'text/css');
    element.setAttribute('data-preserve', 'true');
    element.innerText = queries.join('').replace(/\n/g, '');

    return element;
  }
}

/**
 *
 */
const getLinkContent = async (link: HTMLLinkElement): Promise<string> => {
  const request = await fetch(link.href);
  return await request.text();
}

/**
 *
 */
const clearMediaQueries = (content: string): string => {
  return content.replace(/@media[^{]+\{([\s\S]+?\})\s*\}/g, '');
}

/**
 *
 */
const clearComments = (content: string): string => {
  return content.replace(/\/\*(.|\n)*?\*\*\//g, '');
}

/*
 *
 */
const extract = (content: string)  => {
  const rg = new RegExp('([a-zA-Z0-9\\.#\-_ ]+)[,{]', 'gm');
  const selectors = content.match(rg);
  if (selectors) {
    return selectors.map(selector => {
      try {
        const css = content.match(new RegExp(`${selector}[^}]*`, 'gm'));
        if (css) {
          const style = toObject(
            css.join('')
            .replace(selector, '')
            .replace(/\n/g, '')
            .replace(/;[ ]+/g, ';')
            .trim()
          );

          return selector
            .replace(/\{/g, '')
            .split(',')
            .map(selector => selector.trim())
            .map(selector => ({ selector, style }));
        }
      } catch (e) {}
    })
    .reduce((acc, cur) => acc.concat(cur), []);
  }
}
