import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Download, FileJson, Mail, PackageOpen, RefreshCw, Server, Upload } from 'lucide-react';
import { Button, Card, Input, PageHeader, Badge } from '@/components/ui';
import { BRAND } from '@/lib/brand';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { AdminSystemBackupService, type ImportPreview } from '@/services/admin-system-backup-service';
import { AdminHostingMigrationService } from '@/services/admin-hosting-migration-service';
import { AdminSmtpService, type MailchimpTemplate, type SmtpSettings } from '@/services/admin-smtp-service';
import { DEFAULT_EMAIL_TEMPLATES, EMAIL_BRAND_LOGO_ASSET, EMAIL_TEMPLATE_INFO, EMAIL_TEMPLATE_KEYS, EMAIL_TEMPLATE_PREVIEW_VALUES, renderEmailHtmlTemplate, type EmailTemplate, type EmailTemplateKey } from '@/lib/email-templates';

type SmtpForm = Omit<SmtpSettings, 'passwordConfigured'> & { password: string };
const emptySmtp: SmtpForm = { host: '', port: 587, secure: false, username: '', password: '', fromEmail: '', fromName: 'firx', enabled: false };
const RESTORE_CONFIRMATION_TEXT = 'RESTAURAR E SUBSTITUIR DADOS';
const CLEAR_CONFIRMATION_TEXT = 'APAGAR TODOS OS DADOS';
const MAX_BACKUP_FILE_BYTES = 50_000_000;

function escapePreviewHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] || character);
}

export default function AdminSistema() {
  const envOk = Boolean(import.meta.env.VITE_SUPABASE_URL);
  const migrationBase = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '') || '/';
  const migrationTarget = migrationBase === '/' ? 'public_html' : `public_html${migrationBase}`;
  const backupInputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [selectedBackupFileName, setSelectedBackupFileName] = useState('');
  const [preview, setPreview] = useState<{ name: string; result: ImportPreview; input: unknown } | null>(null);
  const [transferError, setTransferError] = useState('');
  const [transferNotice, setTransferNotice] = useState('');
  const [transferBusy, setTransferBusy] = useState(false);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const [restorePhrase, setRestorePhrase] = useState('');
  const [restoreConfirmError, setRestoreConfirmError] = useState('');
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [clearPhrase, setClearPhrase] = useState('');
  const [clearConfirmError, setClearConfirmError] = useState('');
  const [clearError, setClearError] = useState('');
  const [clearNotice, setClearNotice] = useState('');
  const [migrationBusy, setMigrationBusy] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState('');
  const [migrationNotice, setMigrationNotice] = useState('');
  const [migrationError, setMigrationError] = useState('');
  const [smtp, setSmtp] = useState<SmtpForm>(emptySmtp);
  const [savedSmtpHost, setSavedSmtpHost] = useState('');
  const [passwordConfigured, setPasswordConfigured] = useState(false);
  const [smtpLoading, setSmtpLoading] = useState(true);
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpTesting, setSmtpTesting] = useState(false);
  const [mailchimpTesting, setMailchimpTesting] = useState(false);
  const [smtpCanValidate, setSmtpCanValidate] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [testRecipient, setTestRecipient] = useState('');
  const [smtpError, setSmtpError] = useState('');
  const [smtpNotice, setSmtpNotice] = useState('');
  const [emailTemplates, setEmailTemplates] = useState(DEFAULT_EMAIL_TEMPLATES);
  const [emailTemplateKey, setEmailTemplateKey] = useState<EmailTemplateKey>('vendor_activation');
  const [emailTemplatesLoading, setEmailTemplatesLoading] = useState(true);
  const [emailTemplateSaving, setEmailTemplateSaving] = useState(false);
  const [emailTemplateError, setEmailTemplateError] = useState('');
  const [emailTemplateNotice, setEmailTemplateNotice] = useState('');
  const [mailchimpTemplates, setMailchimpTemplates] = useState<MailchimpTemplate[]>([]);
  const [mailchimpTemplateId, setMailchimpTemplateId] = useState('');
  const [mailchimpSyncing, setMailchimpSyncing] = useState(false);

  const loadEmailTemplates = useCallback(async () => {
    setEmailTemplatesLoading(true);
    setEmailTemplateError('');
    try {
      setEmailTemplates(await AdminSmtpService.getEmailTemplates());
    } catch (error) {
      setEmailTemplateError(error instanceof Error ? error.message : 'Não foi possível carregar os modelos de e-mail.');
    } finally {
      setEmailTemplatesLoading(false);
    }
  }, []);

  const loadSmtp = useCallback(async () => {
    setSmtpLoading(true);
    setSmtpError('');
    try {
      const settings = await AdminSmtpService.getSettings();
      if (settings) {
        setSmtp({ host: settings.host, port: 587, secure: false, username: settings.username, password: '', fromEmail: settings.fromEmail, fromName: settings.fromName, enabled: settings.enabled });
        setSavedSmtpHost(settings.host);
        setPasswordConfigured(settings.passwordConfigured);
        setSmtpCanValidate(settings.passwordConfigured);
      } else {
        setSmtp(emptySmtp);
        setSavedSmtpHost('');
        setPasswordConfigured(false);
        setSmtpCanValidate(false);
      }
    } catch (error) {
      setSmtpError(error instanceof Error ? error.message : 'Não foi possível carregar a configuração SMTP.');
    } finally {
      setSmtpLoading(false);
    }
  }, []);

  useEffect(() => { void loadSmtp(); }, [loadSmtp]);
  useEffect(() => { void loadEmailTemplates(); }, [loadEmailTemplates]);

  const updateEmailTemplate = <K extends keyof EmailTemplate>(field: K, value: EmailTemplate[K]) => {
    setEmailTemplateNotice('');
    setEmailTemplates((current) => ({ ...current, [emailTemplateKey]: { ...current[emailTemplateKey], [field]: value } }));
  };

  const saveEmailTemplate = async (event: React.FormEvent) => {
    event.preventDefault();
    setEmailTemplateSaving(true); setEmailTemplateError(''); setEmailTemplateNotice('');
    try {
      await AdminSmtpService.saveEmailTemplate(emailTemplateKey, emailTemplates[emailTemplateKey]);
      setEmailTemplateNotice('Modelo salvo. Os próximos e-mails deste tipo usarão o HTML atualizado.');
    } catch (error) {
      setEmailTemplateError(error instanceof Error ? error.message : 'Não foi possível salvar o modelo.');
    } finally {
      setEmailTemplateSaving(false);
    }
  };

  const restoreDefaultEmailTemplate = async () => {
    const template = DEFAULT_EMAIL_TEMPLATES[emailTemplateKey];
    setEmailTemplateSaving(true); setEmailTemplateError(''); setEmailTemplateNotice('');
    try {
      await AdminSmtpService.saveEmailTemplate(emailTemplateKey, template);
      setEmailTemplates((current) => ({ ...current, [emailTemplateKey]: template }));
      setEmailTemplateNotice('Modelo padrão restaurado e salvo.');
    } catch (error) {
      setEmailTemplateError(error instanceof Error ? error.message : 'Não foi possível restaurar o modelo padrão.');
    } finally {
      setEmailTemplateSaving(false);
    }
  };

  const updateSmtp = <K extends keyof SmtpForm>(key: K, value: SmtpForm[K]) => {
    setSmtpCanValidate(false);
    setSmtp((current) => ({ ...current, [key]: value }));
  };

  const configureMailchimp = () => {
    setSmtpCanValidate(false);
    setSmtp((current) => ({
      ...current,
      host: 'smtp.mandrillapp.com',
      port: 587,
      secure: false,
      username: current.fromEmail || current.username,
      password: '',
    }));
    setSmtpNotice('Informe a chave do Mailchimp Transactional no campo de senha e salve. A chave será armazenada criptografada no servidor.');
    setSmtpError('');
  };

  const syncMailchimpTemplates = async () => {
    setMailchimpSyncing(true);
    setEmailTemplateError('');
    setEmailTemplateNotice('');
    try {
      const templates = await AdminSmtpService.syncMailchimpTemplates();
      setMailchimpTemplates(templates);
      setMailchimpTemplateId(templates[0] ? String(templates[0].id) : '');
      setEmailTemplateNotice(templates.length
        ? `${templates.length} modelo(s) carregado(s) do Mailchimp Transactional. Escolha um modelo e importe para o tipo selecionado.`
        : 'Conexão feita; nenhum modelo transacional foi encontrado na conta.');
    } catch (error) {
      setEmailTemplateError(error instanceof Error ? error.message : 'Não foi possível carregar os modelos do Mailchimp.');
    } finally {
      setMailchimpSyncing(false);
    }
  };

  const testMailchimpConnection = async () => {
    setMailchimpTesting(true);
    setSmtpError('');
    setSmtpNotice('');
    try {
      setSmtpNotice(await AdminSmtpService.testMailchimpConnection());
    } catch (error) {
      setSmtpError(error instanceof Error ? error.message : 'Falha ao validar a API key Mailchimp.');
    } finally {
      setMailchimpTesting(false);
    }
  };

  const importMailchimpTemplate = async () => {
    const remote = mailchimpTemplates.find((item) => String(item.id) === mailchimpTemplateId);
    if (!remote) return;
    setEmailTemplateSaving(true);
    setEmailTemplateError('');
    setEmailTemplateNotice('');
    try {
      const importedDocument = new DOMParser().parseFromString(remote.html, 'text/html');
      const importedContent = importedDocument.querySelector('.email-content') || importedDocument.body;
      const currentDocument = new DOMParser().parseFromString(emailTemplates[emailTemplateKey].html, 'text/html');
      const currentContent = currentDocument.querySelector('.email-content');
      if (!currentContent) throw new Error('O modelo firx atual não tem a área de conteúdo padrão.');
      const content = importedContent.innerHTML
        .replace(/\*\|\s*FNAME\s*\|\*/gi, '{{nome}}')
        .replace(/\*\|\s*EMAIL\s*\|\*/gi, '{{email}}')
        .replace(/\*\|\s*COMPANY\s*\|\*/gi, '{{empresa}}');
      currentContent.innerHTML = content;
      const html = `<!doctype html>\n${currentDocument.documentElement.outerHTML}`;
      const candidate = { subject: remote.subject || emailTemplates[emailTemplateKey].subject, html };
      await AdminSmtpService.saveEmailTemplate(emailTemplateKey, candidate);
      setEmailTemplates((current) => ({ ...current, [emailTemplateKey]: candidate }));
      setEmailTemplateNotice(`Modelo “${remote.name}” importado para ${EMAIL_TEMPLATE_INFO[emailTemplateKey].name}. O cabeçalho Agência AFRICA e o rodapé firx foram preservados.`);
    } catch (error) {
      setEmailTemplateError(error instanceof Error ? error.message : 'Não foi possível importar este modelo.');
    } finally {
      setEmailTemplateSaving(false);
    }
  };

  const saveSmtp = async (event: React.FormEvent) => {
    event.preventDefault();
    setSmtpSaving(true); setSmtpError(''); setSmtpNotice('');
    try {
      if (smtp.host.trim().toLowerCase() !== savedSmtpHost && !smtp.password) {
        throw new Error('Informe a nova senha ou chave de API ao trocar de provedor SMTP.');
      }
      await AdminSmtpService.saveSettings({ ...smtp, clearPassword: false });
      setSavedSmtpHost(smtp.host.trim().toLowerCase());
      setPasswordConfigured(true);
      setSmtpCanValidate(true);
      setSmtp((current) => ({ ...current, password: '' }));
      setSmtpNotice('Configuração SMTP salva. A senha foi armazenada com proteção no servidor.');
    } catch (error) {
      setSmtpError(error instanceof Error ? error.message : 'Não foi possível salvar a configuração SMTP.');
    } finally {
      setSmtpSaving(false);
    }
  };

  const testSmtp = async () => {
    setSmtpTesting(true); setSmtpError(''); setSmtpNotice('');
    try { setSmtpNotice(await AdminSmtpService.testConnection()); }
    catch (error) { setSmtpError(error instanceof Error ? error.message : 'Falha ao validar o servidor SMTP.'); }
    finally { setSmtpTesting(false); }
  };

  const sendTestEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    setTestSending(true); setSmtpError(''); setSmtpNotice('');
    try { setSmtpNotice(await AdminSmtpService.sendTestEmail(testRecipient.trim())); }
    catch (error) { setSmtpError(error instanceof Error ? error.message : 'Falha ao enviar e-mail de teste.'); }
    finally { setTestSending(false); }
  };

  const downloadBackup = async () => {
    setExporting(true);
    setTransferError('');
    setTransferNotice('');
    try {
      const backup = await AdminSystemBackupService.exportFullSystemBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `growmoney-backup-${backup.createdAt.slice(0, 10)}.json`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (error) {
      setTransferError(error instanceof Error ? error.message : 'Não foi possível exportar os dados.');
    } finally {
      setExporting(false);
    }
  };

  const downloadCpanelPackage = async () => {
    setMigrationBusy(true);
    setMigrationProgress('Gerando backup operacional seguro…');
    setMigrationNotice('');
    setMigrationError('');
    try {
      const backup = await AdminSystemBackupService.exportFullSystemBackup();
      const result = await AdminHostingMigrationService.createCpanelPackage(backup, setMigrationProgress);
      const url = URL.createObjectURL(result.blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `growmoney-migracao-cpanel-${result.createdAt.slice(0, 10)}.zip`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);
      setMigrationNotice(`Pacote pronto com ${result.fileCount.toLocaleString('pt-BR')} arquivos. Consulte o README incluído antes de instalar.`);
    } catch (error) {
      setMigrationError(error instanceof Error ? error.message : 'Não foi possível gerar o pacote de migração.');
    } finally {
      setMigrationBusy(false);
      setMigrationProgress('');
    }
  };

  const validateBackup = async (file?: File) => {
    setPreview(null);
    setTransferError('');
    setTransferNotice('');
    setRestoreConfirmOpen(false);
    setRestorePhrase('');
    setRestoreConfirmError('');
    if (!file) {
      setSelectedBackupFileName('');
      return;
    }
    setSelectedBackupFileName(file.name);
    if (file.size > MAX_BACKUP_FILE_BYTES) {
      setTransferError(`O arquivo "${file.name}" excede o limite de ${MAX_BACKUP_FILE_BYTES / 1_000_000} MB.`);
      return;
    }
    try {
      const rawText = await file.text();
      let input: unknown;
      try {
        input = JSON.parse(rawText);
      } catch {
        throw new Error('O arquivo selecionado não contém um JSON válido.');
      }
      setPreview({ name: file.name, result: AdminSystemBackupService.validateSystemBackup(input), input });
    } catch (error) {
      setTransferError(error instanceof Error ? error.message : 'Não foi possível ler o arquivo selecionado.');
    }
  };

  const openRestoreConfirmation = () => {
    if (!preview?.result.valid || !preview.result.canApply || transferBusy) return;
    setTransferError('');
    setTransferNotice('');
    setRestorePhrase('');
    setRestoreConfirmError('');
    setRestoreConfirmOpen(true);
  };

  const cancelRestoreConfirmation = () => {
    if (transferBusy) return;
    setRestoreConfirmOpen(false);
    setRestorePhrase('');
    setRestoreConfirmError('');
  };

  const confirmRestoreBackup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!preview?.result.valid || !preview.result.canApply || transferBusy) return;
    if (restorePhrase !== RESTORE_CONFIRMATION_TEXT) {
      setRestoreConfirmError(`Texto inválido. Digite exatamente "${RESTORE_CONFIRMATION_TEXT}" (em maiúsculas, sem espaços extras).`);
      return;
    }
    setTransferBusy(true);
    setTransferError('');
    setRestoreConfirmError('');
    setTransferNotice('');
    try {
      const result = await AdminSystemBackupService.restoreSystemBackup(preview.input, restorePhrase);
      setPreview(null);
      setSelectedBackupFileName('');
      if (backupInputRef.current) backupInputRef.current.value = '';
      setRestoreConfirmOpen(false);
      setRestorePhrase('');
      setTransferNotice(`Restauração concluída: ${result.recordCount.toLocaleString('pt-BR')} registros importados.`);
    } catch (error) {
      setTransferError(error instanceof Error ? error.message : 'Não foi possível restaurar o backup. Nenhuma alteração parcial foi mantida.');
    } finally {
      setTransferBusy(false);
    }
  };

  const openClearConfirmation = () => {
    if (transferBusy) return;
    setClearError('');
    setClearNotice('');
    setClearPhrase('');
    setClearConfirmError('');
    setClearConfirmOpen(true);
  };

  const cancelClearConfirmation = () => {
    if (transferBusy) return;
    setClearConfirmOpen(false);
    setClearPhrase('');
    setClearConfirmError('');
  };

  const confirmClearAllSystemData = async (event: React.FormEvent) => {
    event.preventDefault();
    if (transferBusy) return;
    if (clearPhrase !== CLEAR_CONFIRMATION_TEXT) {
      setClearConfirmError(`Texto inválido. Digite exatamente "${CLEAR_CONFIRMATION_TEXT}" (em maiúsculas, sem espaços extras).`);
      return;
    }
    setTransferBusy(true);
    setClearError('');
    setClearConfirmError('');
    setClearNotice('');
    try {
      const result = await AdminSystemBackupService.clearSystemData(clearPhrase);
      setPreview(null);
      setSelectedBackupFileName('');
      if (backupInputRef.current) backupInputRef.current.value = '';
      setRestoreConfirmOpen(false);
      setClearConfirmOpen(false);
      setClearPhrase('');
      const totalDeleted = Object.values(result.deleted || {}).reduce((sum, count) => sum + Number(count || 0), 0);
      setClearNotice(`Limpeza concluída. ${totalDeleted.toLocaleString('pt-BR')} registros operacionais removidos.`);
    } catch (error) {
      setClearError(error instanceof Error ? error.message : 'Não foi possível apagar os dados do sistema.');
    } finally {
      setTransferBusy(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-4 sm:space-y-5">
      <PageHeader title="Sistema" description="Configuração e saúde da plataforma" />
      <Card className="p-5 space-y-4">
        <h2 className="font-semibold">Identidade</h2>
        <div className="flex flex-col xs:flex-row xs:items-center gap-3 sm:gap-4">
          <BrandLogo linkTo={false} heightClass="h-14 sm:h-16" className="max-w-[200px] self-start" />
          <div className="text-sm min-w-0 break-words">
            <p className="font-medium">{BRAND.name}</p>
            <p className="text-text-secondary">{BRAND.product}</p>
            <p className="text-text-secondary text-xs mt-1">{BRAND.site}</p>
          </div>
        </div>
      </Card>
      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2"><Mail className="h-5 w-5 text-brand" /><h2 className="font-semibold">Envio de e-mails (SMTP)</h2></div>
            <p className="mt-1 text-sm text-text-secondary">Configure o servidor usado pelos convites de assinatura e teste a conexão antes de enviar.</p>
          </div>
          <Button type="button" size="sm" variant="outline" leftIcon={<RefreshCw className="h-4 w-4" />} loading={smtpLoading} onClick={() => void loadSmtp()}>Atualizar</Button>
        </div>
        {smtpLoading ? <p className="py-5 text-center text-sm text-text-secondary">Carregando configuração segura…</p> : <>
          <form onSubmit={saveSmtp} className="grid gap-4 sm:grid-cols-2">
            <Input label="Servidor SMTP" placeholder="smtp.exemplo.com" autoComplete="off" required value={smtp.host} onChange={(event) => updateSmtp('host', event.target.value)} />
            <Input label="Porta" type="number" min={1} max={65535} required hint="A hospedagem envia por SMTP autenticado com STARTTLS na porta 587." value={smtp.port} onChange={(event) => updateSmtp('port', Number(event.target.value))} />
            <Input label="Usuário SMTP" autoComplete="username" required value={smtp.username} onChange={(event) => updateSmtp('username', event.target.value)} />
            <Input label={smtp.host === 'smtp.mandrillapp.com' ? 'Chave API Mailchimp Transactional' : passwordConfigured ? 'Nova senha SMTP (opcional)' : 'Senha SMTP'} type="password" autoComplete="new-password" required={!passwordConfigured || (smtp.host !== savedSmtpHost && !smtp.password)} hint={smtp.host === 'smtp.mandrillapp.com' ? 'Use a chave do Mailchimp Transactional como senha SMTP. Ela será transmitida apenas ao serviço seguro e salva criptografada.' : passwordConfigured ? 'Deixe em branco para manter a senha armazenada.' : 'A senha será transmitida somente ao serviço seguro.'} value={smtp.password} onChange={(event) => updateSmtp('password', event.target.value)} />
            <Input label="E-mail remetente" type="email" required value={smtp.fromEmail} onChange={(event) => updateSmtp('fromEmail', event.target.value)} />
            <Input label="Nome remetente" required value={smtp.fromName} onChange={(event) => updateSmtp('fromName', event.target.value)} />
            <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={smtp.secure} onChange={(event) => updateSmtp('secure', event.target.checked)} className="h-4 w-4 accent-brand" /><span><span className="block font-medium">TLS direto (SSL)</span><span className="text-xs text-text-secondary">Desativado para STARTTLS na porta 587. Ative apenas se o servidor exigir TLS desde a conexão inicial.</span></span></label>
            <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={smtp.enabled} onChange={(event) => updateSmtp('enabled', event.target.checked)} className="h-4 w-4 accent-brand" /><span><span className="block font-medium">SMTP ativo</span><span className="text-xs text-text-secondary">Desative para interromper novos envios do sistema.</span></span></label>
            <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
              <Button type="submit" loading={smtpSaving}>Salvar configuração</Button>
              <Button type="button" variant="outline" disabled={smtpSaving} onClick={configureMailchimp}>Usar Mailchimp Transactional</Button>
              <Button type="button" variant="outline" loading={mailchimpTesting} disabled={smtp.host !== 'smtp.mandrillapp.com' || !passwordConfigured} onClick={() => void testMailchimpConnection()}>Testar conexão Mailchimp</Button>
              <Button type="button" variant="outline" leftIcon={<Server className="h-4 w-4" />} loading={smtpTesting} disabled={!smtpCanValidate} onClick={() => void testSmtp()}>Validar servidor SMTP</Button>
              <Badge variant={smtp.enabled && passwordConfigured ? 'success' : 'neutral'}>{smtp.enabled && passwordConfigured ? 'Ativo e configurado' : passwordConfigured ? 'Configurado, desativado' : 'Não configurado'}</Badge>
            </div>
          </form>
          <form onSubmit={sendTestEmail} className="grid gap-3 rounded-xl border border-border-color bg-bg-secondary/40 p-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <div><h3 className="text-sm font-semibold">Teste ao vivo de envio</h3><p className="mb-3 mt-1 text-xs text-text-secondary">Envia uma mensagem de teste real usando o servidor e o remetente configurados.</p><Input label="Enviar teste para" type="email" placeholder="voce@exemplo.com" required value={testRecipient} onChange={(event) => setTestRecipient(event.target.value)} /></div>
            <Button type="submit" leftIcon={<Mail className="h-4 w-4" />} loading={testSending} disabled={!smtp.enabled || !passwordConfigured}>Enviar e-mail de teste</Button>
          </form>
        </>}
        {smtpError && <p className="rounded-lg border border-erro/30 bg-erro/10 p-3 text-sm text-erro" role="alert">{smtpError}</p>}
        {smtpNotice && <p className="rounded-lg border border-brand/30 bg-brand/10 p-3 text-sm" role="status">{smtpNotice}</p>}
        <p className="text-xs text-text-secondary">A senha SMTP não é carregada de volta ao navegador. Para Mailchimp, esta integração usa o produto Mailchimp Transactional (Mandrill), com host smtp.mandrillapp.com, porta 587 e a chave API no campo de senha. O fluxo de convites e outras mensagens usa o provedor salvo; mensagens de autenticação do Supabase Auth dependem da configuração própria de SMTP do Supabase.</p>
      </Card>
      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2"><Mail className="h-5 w-5 text-brand" /><h2 className="font-semibold">Modelos de e-mail</h2></div>
            <p className="mt-1 text-sm text-text-secondary">Edite o assunto e o HTML das mensagens transacionais. A logo da Agência AFRICA aparece obrigatoriamente no cabeçalho de todos os envios; os dados da firx permanecem no rodapé.</p>
          </div>
          <Button type="button" size="sm" variant="outline" leftIcon={<RefreshCw className="h-4 w-4" />} loading={emailTemplatesLoading} onClick={() => void loadEmailTemplates()}>Atualizar modelos</Button>
        </div>
        {emailTemplatesLoading ? <p className="py-5 text-center text-sm text-text-secondary">Carregando modelos…</p> : <>
          <div className="space-y-3 rounded-xl border border-border-color bg-bg-secondary/40 p-4">
            <div>
              <h3 className="text-sm font-semibold">Modelos do Mailchimp Transactional</h3>
              <p className="mt-1 text-xs text-text-secondary">Salve primeiro a configuração usando o host smtp.mandrillapp.com e uma chave API Transactional. A consulta é feita pelo servidor; depois importe cada modelo para o tipo de mensagem selecionado. O layout firx, a logo e o rodapé da empresa permanecem no template.</p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <Button type="button" variant="outline" loading={mailchimpSyncing} disabled={smtp.host !== 'smtp.mandrillapp.com' || !passwordConfigured} onClick={() => void syncMailchimpTemplates()}>Conectar e carregar modelos</Button>
              {mailchimpTemplates.length > 0 && <>
                <label className="min-w-[220px] flex-1 space-y-1.5 text-sm font-medium" htmlFor="mailchimp-template-source">
                  Modelo Mailchimp
                  <select id="mailchimp-template-source" value={mailchimpTemplateId} onChange={(event) => setMailchimpTemplateId(event.target.value)} className="min-h-11 w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-text-primary">
                    {mailchimpTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}{template.published ? '' : ' (rascunho)'}</option>)}
                  </select>
                </label>
                <Button type="button" loading={emailTemplateSaving} disabled={!mailchimpTemplateId} onClick={() => void importMailchimpTemplate()}>Importar para o modelo selecionado</Button>
              </>}
            </div>
          </div>
          <label className="block space-y-1.5 text-sm font-medium" htmlFor="admin-email-template">
            Modelo para editar
            <select id="admin-email-template" value={emailTemplateKey} onChange={(event) => { setEmailTemplateKey(event.target.value as EmailTemplateKey); setEmailTemplateNotice(''); }} className="min-h-11 w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-text-primary">
              {EMAIL_TEMPLATE_KEYS.map((key) => <option key={key} value={key}>{EMAIL_TEMPLATE_INFO[key].name}</option>)}
            </select>
          </label>
          <p className="text-xs text-text-secondary">{EMAIL_TEMPLATE_INFO[emailTemplateKey].description} Variáveis disponíveis: {EMAIL_TEMPLATE_INFO[emailTemplateKey].variables.map((variable) => `{{${variable}}}`).join(', ')}.</p>
          <form onSubmit={saveEmailTemplate} className="space-y-4">
            <Input label="Assunto" required maxLength={180} value={emailTemplates[emailTemplateKey].subject} onChange={(event) => updateEmailTemplate('subject', event.target.value)} />
            <label className="block space-y-1.5 text-sm font-medium" htmlFor="admin-email-template-html">
              HTML do e-mail
              <textarea id="admin-email-template-html" required maxLength={50000} spellCheck={false} value={emailTemplates[emailTemplateKey].html} onChange={(event) => updateEmailTemplate('html', event.target.value)} className="min-h-[320px] w-full resize-y rounded-lg border border-border-color bg-bg-primary px-3 py-3 font-mono text-xs leading-relaxed text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/40" />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" loading={emailTemplateSaving}>Salvar modelo</Button>
              <Button type="button" variant="outline" disabled={emailTemplateSaving} onClick={() => void restoreDefaultEmailTemplate()}>Restaurar padrão</Button>
            </div>
          </form>
          <div className="space-y-2">
            <div><h3 className="text-sm font-semibold">Prévia</h3><p className="text-xs text-text-secondary">A prévia usa dados fictícios e permanece isolada do restante do painel.</p></div>
            <iframe
              title={`Prévia do e-mail: ${EMAIL_TEMPLATE_INFO[emailTemplateKey].name}`}
              sandbox=""
              referrerPolicy="no-referrer"
              srcDoc={renderEmailHtmlTemplate(emailTemplates[emailTemplateKey].html, {
                ...EMAIL_TEMPLATE_PREVIEW_VALUES[emailTemplateKey],
                logoUrl: `${window.location.origin}${import.meta.env.BASE_URL}${EMAIL_BRAND_LOGO_ASSET}`,
              }, escapePreviewHtml)}
              className="h-[480px] w-full rounded-xl border border-border-color bg-white"
            />
          </div>
        </>}
        {emailTemplateError && <p className="rounded-lg border border-erro/30 bg-erro/10 p-3 text-sm text-erro" role="alert">{emailTemplateError}</p>}
        {emailTemplateNotice && <p className="rounded-lg border border-brand/30 bg-brand/10 p-3 text-sm" role="status">{emailTemplateNotice}</p>}
        <p className="text-xs text-text-secondary">Os convites de assinatura, a ativação de vendedores e os testes SMTP usam estes modelos. Os e-mails de autenticação, como confirmação e recuperação de senha, continuam configurados no serviço de autenticação do Supabase.</p>
      </Card>
      <Card className="p-5 space-y-3">
        <h2 className="font-semibold">Integrações</h2>
        <div className="flex items-center justify-between gap-3 text-sm">
          <span>Supabase</span>
          <Badge variant={envOk ? 'success' : 'danger'}>{envOk ? 'Configurado' : 'Ausente'}</Badge>
        </div>
        <div className="flex items-center justify-between gap-3 text-sm">
          <span>Ambiente</span>
          <Badge variant="info">{import.meta.env.MODE}</Badge>
        </div>
      </Card>
      <Card className="space-y-4 border border-brand/30 p-5">
        <div>
          <div className="flex items-center gap-2"><PackageOpen className="h-5 w-5 text-brand" /><h2 className="font-semibold">Migração para cPanel</h2></div>
          <p className="mt-1 text-sm text-text-secondary">Gere um ZIP pronto para enviar pelo Gerenciador de Arquivos do cPanel. O pacote inclui a aplicação publicada, regras de rota, ponte SMTP sem credenciais e backup operacional.</p>
        </div>
        <ul className="grid gap-2 rounded-xl border border-border-color bg-bg-secondary/40 p-4 text-sm text-text-secondary">
          <li>Envie os arquivos extraídos para <code className="rounded bg-bg-primary px-1.5 py-0.5">{migrationTarget}</code> e mantenha o caminho <code className="rounded bg-bg-primary px-1.5 py-0.5">{migrationBase}</code>.</li>
          <li>Autenticação, banco, Storage e funções continuam no Supabase configurado nesta build.</li>
          <li>O backup operacional não leva usuários, permissões, auditoria, segredos, tokens privados ou arquivos binários do Storage.</li>
          <li>O SMTP exige configurar a chave privada no novo cPanel e atualizar os segredos da função no Supabase; as instruções estão no ZIP.</li>
        </ul>
        <Button leftIcon={<PackageOpen className="h-4 w-4" />} loading={migrationBusy} onClick={() => void downloadCpanelPackage()}>Gerar pacote para cPanel</Button>
        {migrationProgress && <p className="text-sm text-text-secondary" role="status">{migrationProgress}</p>}
        {migrationNotice && <p className="rounded-lg border border-brand/30 bg-brand/10 p-3 text-sm" role="status">{migrationNotice}</p>}
        {migrationError && <p className="rounded-lg border border-erro/30 bg-erro/10 p-3 text-sm text-erro" role="alert">{migrationError}</p>}
      </Card>
      <Card className="space-y-4 p-5">
        <div>
          <h2 className="font-semibold">Backup e importação</h2>
          <p className="mt-1 text-sm text-text-secondary">Exporte dados operacionais ou valide um backup e revise o conteúdo antes de qualquer importação.</p>
        </div>
        <Button leftIcon={<Download className="h-4 w-4" />} loading={exporting} disabled={transferBusy} onClick={() => void downloadBackup()}>Exportar backup do sistema</Button>
        <div className="space-y-3 rounded-xl border border-border-color bg-bg-secondary/40 p-4">
          <div className="flex items-center gap-2"><FileJson className="h-4 w-4 text-brand" /><h3 className="text-sm font-semibold">Validar arquivo de backup</h3></div>
          <label className="block text-sm font-medium text-text-primary" htmlFor="admin-backup-file">Arquivo JSON</label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              ref={backupInputRef}
              id="admin-backup-file"
              type="file"
              accept="application/json,.json"
              disabled={transferBusy}
              onChange={(event) => {
                const selected = event.target.files?.[0];
                event.target.value = '';
                void validateBackup(selected);
              }}
              className="peer sr-only"
            />
            <label
              htmlFor="admin-backup-file"
              className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-hover peer-focus-visible:ring-2 peer-focus-visible:ring-brand peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-bg-secondary ${transferBusy ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              Escolher arquivo
            </label>
            <span
              className="min-w-0 flex-1 truncate rounded-xl border border-border-color bg-bg-primary px-3.5 py-2.5 text-sm text-text-primary"
              title={selectedBackupFileName || 'Nenhum arquivo selecionado'}
            >
              {selectedBackupFileName || <span className="text-text-secondary">Nenhum arquivo selecionado</span>}
            </span>
          </div>
          {preview && <div className="space-y-3 rounded-lg border border-border-color bg-bg-primary p-3" role="status">
            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold"><Upload className="h-4 w-4" />{preview.name}<Badge variant={preview.result.valid ? 'success' : 'danger'}>{preview.result.valid ? 'Válido' : 'Com erros'}</Badge></div>
            <p className="text-sm">{preview.result.recordCount.toLocaleString('pt-BR')} registros no total</p>
            <ul className="grid gap-1 text-sm sm:grid-cols-2">{Object.entries(preview.result.tableCounts).map(([table, count]) => <li key={table} className="flex justify-between gap-3"><span className="break-all">{table}</span><span className="font-mono tabular-nums">{(count || 0).toLocaleString('pt-BR')}</span></li>)}</ul>
            {preview.result.errors.length > 0 && <div><p className="text-sm font-semibold text-erro">Erros de validação</p><ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-erro">{preview.result.errors.map((error, index) => <li key={`${index}-${error}`}>{error}</li>)}</ul></div>}
            {preview.result.warnings.length > 0 && <div><p className="text-sm font-semibold">Avisos</p><ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-text-secondary">{preview.result.warnings.map((warning, index) => <li key={`${index}-${warning}`}>{warning}</li>)}</ul></div>}
            <p className="rounded-lg bg-aviso/10 p-3 text-xs text-text-secondary">{preview.result.blockedReason}</p>
            {!restoreConfirmOpen ? (
              <Button disabled={!preview.result.canApply || transferBusy} loading={transferBusy} onClick={openRestoreConfirmation} title={preview.result.blockedReason}>
                {preview.result.canApply ? 'Importar e substituir dados' : 'Importação indisponível'}
              </Button>
            ) : (
              <form onSubmit={(event) => void confirmRestoreBackup(event)} className="space-y-3 rounded-xl border border-aviso/50 bg-aviso/10 p-4">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-aviso" aria-hidden="true" />
                  <div className="space-y-1 text-xs text-text-primary">
                    <p className="font-semibold">Confirmar restauração e substituição dos dados</p>
                    <p className="text-text-secondary">
                      A restauração substituirá em uma única transação os dados operacionais atuais. Usuários, permissões administrativas, auditoria, SMTP e arquivos binários do Storage serão preservados.
                    </p>
                    <p className="pt-1">
                      Para autorizar, digite exatamente:{' '}
                      <code className="select-all rounded bg-bg-primary px-1.5 py-0.5 font-mono font-semibold text-text-primary">{RESTORE_CONFIRMATION_TEXT}</code>
                    </p>
                  </div>
                </div>
                <Input
                  id="admin-restore-confirmation"
                  label="Texto de confirmação"
                  placeholder={RESTORE_CONFIRMATION_TEXT}
                  autoComplete="off"
                  spellCheck={false}
                  disabled={transferBusy}
                  value={restorePhrase}
                  onChange={(event) => {
                    setRestorePhrase(event.target.value);
                    if (restoreConfirmError) setRestoreConfirmError('');
                  }}
                  error={restoreConfirmError || undefined}
                />
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" variant="danger" loading={transferBusy} disabled={transferBusy}>
                    Confirmar restauração
                  </Button>
                  <Button type="button" variant="outline" disabled={transferBusy} onClick={cancelRestoreConfirmation}>
                    Cancelar
                  </Button>
                </div>
              </form>
            )}
          </div>}
        </div>
        {transferNotice && <p className="rounded-lg border border-brand/30 bg-brand/10 p-3 text-sm text-text-primary" role="status">{transferNotice}</p>}
        {transferError && <p className="rounded-lg border border-erro/30 bg-erro/10 p-3 text-sm text-erro" role="alert">{transferError}</p>}
        <p className="text-xs text-text-secondary">O backup exclui identidades, memberships, convites, autorização administrativa, auditoria e históricos. Envelopes de assinatura e tokens privados também são excluídos. Os binários do Storage não são exportados; eles permanecem no mesmo ambiente durante a restauração. A prévia não grava dados.</p>
      </Card>
      <Card className="space-y-4 border border-erro/40 bg-erro/5 p-5">
        <div>
          <h2 className="font-semibold text-erro">Apagar dados operacionais</h2>
          <p className="mt-1 text-sm text-text-secondary">Remove empresas, clientes, serviços, contratos, assinaturas, agenda e lançamentos financeiros. A limpeza é irreversível e exige confirmação explícita.</p>
        </div>
        {!clearConfirmOpen ? (
          <Button variant="danger" disabled={transferBusy} loading={transferBusy} onClick={openClearConfirmation}>Apagar todos os dados do sistema</Button>
        ) : (
          <form onSubmit={(event) => void confirmClearAllSystemData(event)} className="space-y-3 rounded-xl border border-erro/40 bg-bg-primary p-4">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-erro" aria-hidden="true" />
              <div className="space-y-1 text-xs text-text-primary">
                <p className="font-semibold text-erro">Ação irreversível — confirmar exclusão total</p>
                <p className="text-text-secondary">
                  Todos os cadastros e dados operacionais serão apagados. Logins, perfis, permissões administrativas, auditoria, SMTP e binários já armazenados serão preservados.
                </p>
                <p className="pt-1">
                  Para confirmar, digite exatamente:{' '}
                  <code className="select-all rounded bg-bg-secondary px-1.5 py-0.5 font-mono font-semibold text-text-primary">{CLEAR_CONFIRMATION_TEXT}</code>
                </p>
              </div>
            </div>
            <Input
              id="admin-clear-confirmation"
              label="Texto de confirmação"
              placeholder={CLEAR_CONFIRMATION_TEXT}
              autoComplete="off"
              spellCheck={false}
              disabled={transferBusy}
              value={clearPhrase}
              onChange={(event) => {
                setClearPhrase(event.target.value);
                if (clearConfirmError) setClearConfirmError('');
              }}
              error={clearConfirmError || undefined}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="danger" loading={transferBusy} disabled={transferBusy}>
                Confirmar exclusão definitiva
              </Button>
              <Button type="button" variant="outline" disabled={transferBusy} onClick={cancelClearConfirmation}>
                Cancelar
              </Button>
            </div>
          </form>
        )}
        {clearNotice && <p className="rounded-lg border border-brand/30 bg-brand/10 p-3 text-sm text-text-primary" role="status">{clearNotice}</p>}
        {clearError && <p className="rounded-lg border border-erro/30 bg-erro/10 p-3 text-sm text-erro" role="alert">{clearError}</p>}
        <p className="text-xs text-text-secondary">Logins, perfis, permissões administrativas, auditoria, configuração SMTP e arquivos binários são preservados. Para remover logins ou arquivos, use seus módulos próprios.</p>
      </Card>
      <Card className="p-5 space-y-2 text-sm text-text-secondary">
        <h2 className="font-semibold text-text-primary">Notas</h2>
        <p>
          As telas administrativas validam a sessão com a função de autorização da plataforma e dependem das políticas de acesso do banco.
        </p>
      </Card>
    </div>
  );
}
