import React from 'react';
import { FormInput } from './FormInput';

interface DynamicCustomFieldsProps {
  storageKey: string;
  data: any;
  onChange: (updatedData: any) => void;
}

export default function DynamicCustomFields({
  storageKey,
  data,
  onChange
}: DynamicCustomFieldsProps) {
  let customCols: { id: string; label: string }[] = [];
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored) as any[];
      customCols = parsed.filter(col => col && (col.isCustom || col.id?.startsWith('custom_')));
    }
  } catch (e) {
    console.error(e);
  }

  if (customCols.length === 0) return null;

  return (
    <div className="space-y-4 pt-4 border-t border-gray-100">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {customCols.map(col => (
          <FormInput
            key={col.id}
            label={`${col.label}`}
            type="text"
            value={data[col.id] || ''}
            onChange={(e) => {
              onChange({
                ...data,
                [col.id]: e.target.value
              });
            }}
          />
        ))}
      </div>
    </div>
  );
}
