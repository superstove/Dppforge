const API_BASE = import.meta.env.VITE_API_URL || '/api';

export const api = {
  convertManual: async (data: any) => {
    const res = await fetch(`${API_BASE}/convert/manual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Conversion failed' }));
      throw new Error(err.detail || 'Conversion failed');
    }
    return await res.json();
  },

  convertUpload: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/convert/upload`, {
      method: 'POST',
      body: formData
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Extraction failed' }));
      throw new Error(err.detail || 'Extraction failed');
    }
    return await res.json();
  },

  saveDpp: async (dpp_json: any) => {
    const res = await fetch(`${API_BASE}/convert/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dpp_json })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Save failed' }));
      throw new Error(err.detail || 'Save failed');
    }
    return await res.json();
  },

  previewQr: async (dpp_json: any): Promise<Blob> => {
    const res = await fetch(`${API_BASE}/convert/preview-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dpp_json })
    });
    if (!res.ok) throw new Error('QR generation failed');
    return await res.blob();
  },

  downloadJson: async (dpp_json: any): Promise<Blob> => {
    const res = await fetch(`${API_BASE}/convert/download-json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dpp_json })
    });
    if (!res.ok) throw new Error('JSON download failed');
    return await res.blob();
  },

  getPassports: async () => {
    const res = await fetch(`${API_BASE}/passports/`);
    if (!res.ok) throw new Error('Failed to load passports');
    return await res.json();
  },

  getPassport: async (id: number | string) => {
    const res = await fetch(`${API_BASE}/passports/${id}`);
    if (!res.ok) throw new Error('Failed to load passport');
    return await res.json();
  },

  deletePassport: async (id: number | string) => {
    const res = await fetch(`${API_BASE}/passports/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete passport');
    return await res.json();
  }
};
