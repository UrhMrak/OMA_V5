import { useRef, useState } from 'react';
import { api } from '../../lib/api';

export default function UploadDropzone({ onUploaded }: { onUploaded: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const defaultFolder = `${new Date().getFullYear()}/week 45`;
  const [folder, setFolder] = useState(defaultFolder);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('folder', folder);
      for (const f of Array.from(files)) form.append('files', f);
      await api.upload('/api/library/upload', form);
      onUploaded();
    } catch (e: any) {
      const message = e?.message || 'Upload failed. Only PDFs up to 25MB are allowed.';
      setError(message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="row-gap">
      <div className="row">
        <label className="label">Target folder</label>
        <input className="input" value={folder} onChange={(e) => setFolder(e.target.value)} />
      </div>
      {error && <div className="error">{error}</div>}
      <div className={`dropzone ${busy ? 'disabled' : ''}`} onClick={() => inputRef.current?.click()}>
        <input ref={inputRef} type="file" multiple accept="application/pdf" style={{ display: 'none' }} onChange={(e) => onFiles(e.target.files)} />
        <span>Drag & drop PDFs here or click to select</span>
      </div>
    </div>
  );
}


