"use client";

import { useState, useEffect, useCallback } from "react";
import type { ModelProviderKey } from "@/lib/ai/model-provider-config";

const STORAGE_KEY = "offeryou:model-provider";

type ProviderOption = {
  key: ModelProviderKey;
  label: string;
  shortLabel: string;
};

const PROVIDER_OPTIONS: ProviderOption[] = [
  { key: "openai_compatible", label: "小米 MiMo", shortLabel: "MiMo" },
  { key: "gemini", label: "Google Gemini", shortLabel: "Gemini" },
  { key: "antigravity_cli", label: "Antigravity CLI", shortLabel: "AGY" },
  { key: "codex_cli", label: "Codex CLI", shortLabel: "Codex" },
];

const VALID_PROVIDERS = new Set<string>(PROVIDER_OPTIONS.map((o) => o.key));

function isValidProvider(value: string): value is ModelProviderKey {
  return VALID_PROVIDERS.has(value);
}

export function useModelPreference() {
  const [provider, setProviderState] = useState<ModelProviderKey>("openai_compatible");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached && isValidProvider(cached)) {
      setProviderState(cached);
      setLoading(false);
    }

    fetch("/api/model-provider")
      .then((r) => r.json())
      .then((data) => {
        if (isValidProvider(data.provider)) {
          setProviderState(data.provider);
          localStorage.setItem(STORAGE_KEY, data.provider);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const setProvider = useCallback((newProvider: ModelProviderKey) => {
    setProviderState(newProvider);
    localStorage.setItem(STORAGE_KEY, newProvider);

    fetch("/api/model-provider", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: newProvider }),
    }).catch(() => {});
  }, []);

  return { provider, setProvider, loading, options: PROVIDER_OPTIONS };
}
