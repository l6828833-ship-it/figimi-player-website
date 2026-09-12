"use client";

export function CopyField({ value }: { value: string }) {
  return <input readOnly value={value} onFocus={(event) => event.currentTarget.select()} onClick={(event) => event.currentTarget.select()} />;
}
