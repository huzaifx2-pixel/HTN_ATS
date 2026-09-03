export function insertTextAtCursor(
  element: HTMLTextAreaElement | HTMLInputElement,
  text: string,
  currentValue: string,
  setValue: (value: string) => void
) {
  const start = element.selectionStart ?? currentValue.length;
  const end = element.selectionEnd ?? currentValue.length;
  const nextValue = currentValue.slice(0, start) + text + currentValue.slice(end);
  setValue(nextValue);

  requestAnimationFrame(() => {
    element.focus();
    const cursor = start + text.length;
    element.setSelectionRange(cursor, cursor);
  });
}

/** Insert HTML at the caret of a contenteditable, or append if the caret is elsewhere. */
export function insertHtmlIntoContentEditable(editor: HTMLElement, html: string) {
  editor.focus();
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !editor.contains(selection.anchorNode)) {
    editor.insertAdjacentHTML("beforeend", html);
    return editor.innerHTML;
  }

  const range = selection.getRangeAt(0);
  range.deleteContents();
  const holder = document.createElement("div");
  holder.innerHTML = html;
  const fragment = document.createDocumentFragment();
  while (holder.firstChild) fragment.appendChild(holder.firstChild);
  const last = fragment.lastChild;
  range.insertNode(fragment);
  if (last) {
    range.setStartAfter(last);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }
  return editor.innerHTML;
}

export function insertTextAtCursorUncontrolled(
  element: HTMLTextAreaElement | HTMLInputElement,
  text: string
) {
  const start = element.selectionStart ?? element.value.length;
  const end = element.selectionEnd ?? element.value.length;
  element.value = element.value.slice(0, start) + text + element.value.slice(end);
  element.dispatchEvent(new Event("input", { bubbles: true }));

  requestAnimationFrame(() => {
    element.focus();
    const cursor = start + text.length;
    element.setSelectionRange(cursor, cursor);
  });
}
