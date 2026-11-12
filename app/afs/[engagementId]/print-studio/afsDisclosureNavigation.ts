/** Open the actual editor after React has mounted Work mode, never a PDF clone. */
export function openDisclosureEditor(key: string, policy = false, root: Document = document) {
  const container = policy ? root.getElementById("afs-standards-review") : root.getElementById("print-notes-work");
  if (!container) return false;
  if (policy) (container as HTMLDetailsElement).open = true;
  const editor = container.querySelector<HTMLDetailsElement>(`[data-disclosure-section="${key}"]`);
  if (!editor) return false;
  editor.open = true;
  const field = editor.querySelector<HTMLTextAreaElement>('textarea[aria-invalid="true"]') || editor.querySelector<HTMLTextAreaElement>("textarea");
  // Focus without a second browser-driven scroll that could override the jump.
  field?.focus({preventScroll:true});
  const destination = field?.closest("fieldset") || editor;
  (destination as HTMLElement).style.scrollMarginTop = "44px";
  destination.scrollIntoView({behavior:"auto",block:"start"});
  return true;
}
