# Dialog Migration to SkateModal

## Objetivo

Padronizar TODOS os dialogs do site usando o componente `SkateModal` para consistência visual e UX.

## Componentes Criados

### 1. SkateDialog (`components/shared/SkateDialog.tsx`)
- Dialog unificado para alert/confirm/prompt
- Baseado no SkateModal existente
- Estilo consistente com tema SkateHive

### 2. useSkateDialog (`hooks/useSkateDialog.tsx`)
- Hook helper para usar SkateDialog facilmente
- API similar a window.prompt/confirm/alert
- Retorna promises (async/await friendly)

**Uso:**
```tsx
const { prompt, confirm, alert, SkateDialogComponent } = useSkateDialog();

// No JSX:
<SkateDialogComponent />

// Nos handlers:
const desc = await prompt("Describe image:", { tip: "Be specific!" });
const ok = await confirm("Delete post?");
await alert("Success!");
```

## Arquivos a Migrar

### ✅ Concluído

1. **SnapComposer.tsx** (linha 277)
   - ✅ Migrado window.prompt → SkateDialog
   - Prompt de SEO para imagens

### 🔄 Em Progresso

Nenhum no momento

### ⏳ Pendente

2. **useFileUpload.ts** (linha 42)
   - window.prompt (SEO prompt duplicado)
   - **Solução:** Aceitar função de prompt como parâmetro do hook

3. **AccountLinkingModal.tsx** (linhas 348, 530)
   - 2x window.confirm (merge de contas)
   - **Prioridade:** Alta (UX crítica de autenticação)

4. **UserbaseIdentityLinker.tsx** (linha 189)
   - window.confirm (merge de identidades)
   - **Prioridade:** Alta (UX crítica de autenticação)

### 📊 Chakra AlertDialog/Modal (auditoria pendente)

Arquivos que usam AlertDialog/Modal do Chakra:
- AuctionPage.tsx
- BidsModal.tsx
- EmbeddedMap.tsx
- SpotList.tsx
- VideoTrimModal.tsx
- EditPostModal.tsx
- SnapList.tsx
- GIFMakerWithSelector.tsx
- SnapReplyModal.tsx
- ShareMenuButtons.tsx
- DevMetadataDialogContent.tsx
- VideoUploader.tsx
- InstagramModal.tsx
- VideoTrimModalFooter.tsx
- AccountLinkingDetector.tsx
- AuthButton.tsx
- FooterNavButtons.tsx

**Estratégia:** Avaliar caso a caso. Alguns podem ser migrados, outros já usam SkateModal ou são complexos demais.

## Progresso

| Status | Count |
|---------|-------|
| ✅ Concluído | 1 |
| 🔄 Em Progresso | 0 |
| ⏳ Pendente | 3 |
| 📊 Auditoria | ~18 |

## Próximos Passos

1. Testar SnapComposer localmente (screenshot + approve)
2. Migrar AccountLinkingModal (2x confirms)
3. Migrar UserbaseIdentityLinker (1x confirm)
4. Refatorar useFileUpload (aceitar prompt como param)
5. Auditar Chakra Modals complexos

## Notas

- useFileUpload precisa de abordagem diferente (hooks não podem ter JSX)
- Alguns Chakra Modals podem não valer a pena migrar se já funcionam bem
- Prioridade: dialogs nativos (window.*) → Chakra AlertDialog → Chakra Modal
