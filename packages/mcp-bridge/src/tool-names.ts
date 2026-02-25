export function toExternalName(internal: string): string {
  return internal.replace(/\./g, '_');
}

export type ToolNameMaps = {
  externalToInternal: Map<string, string>;
  internalToExternal: Map<string, string>;
  allowedExternalTools: Set<string>;
};

export function buildToolNameMaps(internalTools: Iterable<string>): ToolNameMaps {
  const externalToInternal = new Map<string, string>();
  const internalToExternal = new Map<string, string>();

  for (const internal of internalTools) {
    const external = toExternalName(internal);
    externalToInternal.set(external, internal);
    internalToExternal.set(internal, external);
  }

  return {
    externalToInternal,
    internalToExternal,
    allowedExternalTools: new Set(externalToInternal.keys()),
  };
}

export function resolveInternalToolName(externalOrInternal: string, externalToInternal: Map<string, string>): string | undefined {
  return externalToInternal.get(externalOrInternal) ?? externalToInternal.get(toExternalName(externalOrInternal));
}
