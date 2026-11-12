"use client";
import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type InputHTMLAttributes,
} from "react";
import { completedAmount } from "@/app/lib/afsAmountInput";
/** Keep keystrokes local; update the accounting calculation only on blur or Enter. */
const AfsAmountInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function AfsAmountInput(
  {
    value,
    defaultValue,
    onChange,
    onBlur,
    onFocus,
    onKeyDown,
    type: _type,
    inputMode,
    min,
    max,
    ...props
  },
  forwardedRef,
) {
  const [draft, setDraft] = useState(String(value ?? defaultValue ?? "")),
    [invalid, setInvalid] = useState(false);
  const focused = useRef(false),
    nodeRef = useRef<HTMLInputElement | null>(null),
    committed = useRef(String(value ?? defaultValue ?? ""));
  const ref = useCallback(
    (node: HTMLInputElement | null) => {
      nodeRef.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    },
    [forwardedRef],
  );
  useEffect(() => {
    const next = String(value ?? defaultValue ?? "");
    committed.current = next;
    if (!focused.current) {
      setDraft(next);
      setInvalid(false);
      nodeRef.current?.setCustomValidity("");
    }
  }, [value, defaultValue]);
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !focused.current ||
      draft === committed.current
    )
      return;
    const warn = (event: BeforeUnloadEvent) => {
      if (focused.current && draft !== committed.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [draft, value]);
  function commit(event: FocusEvent<HTMLInputElement>) {
    focused.current = false;
    const node = event.currentTarget,
      result = completedAmount(node.value, min, max);
    if (result.error) {
      node.setCustomValidity(result.error);
      setInvalid(true);
      node.reportValidity();
      return;
    }
    node.setCustomValidity("");
    setInvalid(false);
    setDraft(result.value);
    node.value = result.value;
    if (result.value !== committed.current) {
      committed.current = result.value;
      onChange?.({
        ...event,
        type: "change",
        target: node,
        currentTarget: node,
      } as unknown as ChangeEvent<HTMLInputElement>);
    }
    onBlur?.(event);
  }
  return (
    <input
      {...props}
      ref={ref}
      type="text"
      inputMode={inputMode || "decimal"}
      value={draft}
      aria-invalid={invalid || props["aria-invalid"] || undefined}
      onFocus={(event) => {
        focused.current = true;
        onFocus?.(event);
      }}
      onChange={(event) => {
        setDraft(event.currentTarget.value);
        if (invalid) {
          event.currentTarget.setCustomValidity("");
          setInvalid(false);
        }
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.key === "Enter" && !event.defaultPrevented) {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
    />
  );
});
export default AfsAmountInput;
