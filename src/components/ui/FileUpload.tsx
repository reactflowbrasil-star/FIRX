import { useEffect, useRef, useState } from 'react';
import { Upload, File, X, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { listarArquivos, uploadArquivo, type ArquivoCategoria, type ArquivoEnviado } from '@/services/file-storage';

interface FileUploadProps {
  accept?: string;
  multiple?: boolean;
  maxSizeMb?: number;
  label?: string;
  onChange?: (files: File[]) => void;
  onUploaded?: (files: ArquivoEnviado[]) => void;
  value?: File[];
  className?: string;
  categoria?: ArquivoCategoria;
}

export function FileUpload({
  accept = 'image/*,.pdf,.doc,.docx,.xls,.xlsx',
  multiple = false,
  maxSizeMb = 10,
  label = 'Arraste arquivos ou clique para enviar',
  onChange,
  className,
  categoria = 'arquivos',
  onUploaded,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<Array<string | null>>([]);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [savedFiles, setSavedFiles] = useState<ArquivoEnviado[]>([]);
  const previewsRef = useRef<Array<string | null>>([]);
  previewsRef.current = previews;

  useEffect(() => {
    return () => {
      previewsRef.current.forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, []);

  useEffect(() => {
    let active = true;
    void listarArquivos(categoria)
      .then((items) => { if (active) setSavedFiles(items); })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar seus arquivos.');
      });
    return () => { active = false; };
  }, [categoria]);

  const handleFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    setError('');
    const arr = Array.from(list);
    const tooBig = arr.find((f) => f.size > maxSizeMb * 1024 * 1024);
    if (tooBig) {
      setError(`Arquivo acima de ${maxSizeMb}MB: ${tooBig.name}`);
      return;
    }
    const next = multiple ? [...files, ...arr] : arr.slice(0, 1);
    if (!multiple) {
      previews.forEach((url) => { if (url) URL.revokeObjectURL(url); });
    }
    const addedPreviews = (multiple ? arr : next).map((f) =>
      f.type.startsWith('image/') ? URL.createObjectURL(f) : null
    );
    const nextPreviews = multiple ? [...previews, ...addedPreviews] : addedPreviews;
    setFiles(next);
    setPreviews(nextPreviews);
    onChange?.(next);
    setUploading(true);
    try {
      const results = await Promise.allSettled(arr.map((file) => uploadArquivo(file, categoria)));
      const uploaded = results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
      if (uploaded.length) {
        setSavedFiles((current) => {
          const merged = [...uploaded, ...current.filter((item) => !uploaded.some((file) => file.id === item.id))];
          return multiple ? merged : uploaded;
        });
        onUploaded?.(uploaded);
      }
      const failed = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
      if (failed) throw failed.reason;
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Falha ao salvar arquivo no servidor.');
    } finally {
      setUploading(false);
    }
  };

  const remove = (i: number) => {
    const removedUrl = previews[i];
    if (removedUrl) URL.revokeObjectURL(removedUrl);
    const next = files.filter((_, idx) => idx !== i);
    const nextPreviews = previews.filter((_, idx) => idx !== i);
    setFiles(next);
    setPreviews(nextPreviews);
    onChange?.(next);
    if (!multiple) setSavedFiles([]);
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div
        role="button"
        tabIndex={0}
        aria-label={label}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          'border-2 border-dashed border-border-color rounded-xl p-6 text-center cursor-pointer',
          'hover:border-brand/50 hover:bg-brand/5 transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand'
        )}
      >
        <Upload className="w-8 h-8 mx-auto text-text-secondary mb-2" />
          <p className="text-sm text-text-primary font-medium">{uploading ? 'Salvando no servidor...' : label}</p>
        <p className="text-xs text-text-secondary mt-1">PDF, imagens, Word, Excel · máx. {maxSizeMb}MB</p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
      {error && <p className="text-sm text-erro" role="alert">{error}</p>}
      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-3 p-2 rounded-lg bg-bg-secondary border border-border-color">
              {f.type.startsWith('image/') && previews[i] ? (
                <img src={previews[i]!} alt="" className="w-10 h-10 rounded object-cover" />
              ) : f.type.startsWith('image/') ? (
                <ImageIcon className="w-5 h-5 text-brand" />
              ) : (
                <File className="w-5 h-5 text-text-secondary" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{f.name}</p>
                <p className="text-xs text-text-secondary">
                  {(f.size / 1024).toFixed(1)} KB
                  {savedFiles[i] && <> · <a className="text-brand hover:underline" href={savedFiles[i].url} target="_blank" rel="noreferrer">Salvo no servidor</a></>}
                </p>
              </div>
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label={`Remover ${f.name}`}
                className="p-1.5 rounded-lg text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
              >
                <X className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {savedFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-text-secondary">Arquivos salvos no servidor</p>
          <ul className="space-y-2">
            {savedFiles.map((file) => (
              <li key={file.id} className="flex items-center gap-3 p-2 rounded-lg bg-bg-secondary border border-border-color">
                {file.tipo.startsWith('image/') ? (
                  <a href={file.url} target="_blank" rel="noreferrer" aria-label={`Abrir ${file.nome}`}>
                    <img src={file.url} alt="" className="w-10 h-10 rounded object-cover" />
                  </a>
                ) : <File className="w-5 h-5 text-text-secondary" />}
                <div className="min-w-0 flex-1">
                  <a className="text-sm font-medium truncate block text-brand hover:underline" href={file.url} target="_blank" rel="noreferrer">
                    {file.nome}
                  </a>
                  <p className="text-xs text-text-secondary">{(file.tamanho / 1024).toFixed(1)} KB · salvo na sua conta</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

