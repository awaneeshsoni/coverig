'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sparkles } from 'lucide-react';

interface AiField {
  key: string;
  label: string;
}

interface AiHelperProps {
  open: boolean;
  onClose: () => void;
  onApply: (key: string, value: string) => void;
  fields: AiField[];
  templateName: string;
}

export function AiHelper({ open, onClose, onApply, fields, templateName }: AiHelperProps) {
  const [topic, setTopic] = useState('');
  const [selectedKey, setSelectedKey] = useState(fields[0]?.key || '');
  const [generatedText, setGeneratedText] = useState('');
  const [loading, setLoading] = useState(false);

  async function generate() {
    if (!topic.trim()) return;
    setLoading(true);
    setGeneratedText('');

    try {
      const field = fields.find((f) => f.key === selectedKey);

      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          element_label: field?.label || '',
          template_name: templateName,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setGeneratedText(data.data);
    } catch {
      setGeneratedText('Failed to generate. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="AI SUGGEST">
      <div className="space-y-4">
        <Input
          id="topic"
          label="Topic / Context"
          placeholder="e.g., fitness tips for beginners"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        />

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-zinc-300">Target Element</label>
          <select
            value={selectedKey}
            onChange={(e) => setSelectedKey(e.target.value)}
            className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          >
            {fields.map((f) => (
              <option key={f.key} value={f.key}>{f.label}</option>
            ))}
          </select>
        </div>

        <Button onClick={generate} loading={loading} className="w-full">
          <Sparkles className="h-4 w-4 mr-2" />
          Generate
        </Button>

        {generatedText && (
          <div className="rounded border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-sm text-zinc-800 mb-3">{generatedText}</p>
            <Button
              size="sm"
              onClick={() => onApply(selectedKey, generatedText)}
            >
              Apply
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
