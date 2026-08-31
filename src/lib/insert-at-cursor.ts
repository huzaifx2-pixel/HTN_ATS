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
