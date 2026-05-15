import { useRef } from "react";
import { useDraggable } from "@heroui/react";

export function useModalDraggable(isOpen: boolean) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const targetRef = useRef<any>(null);
  const { moveProps } = useDraggable({ targetRef, isDisabled: !isOpen, canOverflow: false });
  return { targetRef, moveProps };
}
