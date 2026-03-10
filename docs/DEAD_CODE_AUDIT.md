# Dead Code Audit — 2026-03-10

**Scan completo:** components/, app/, lib/, hooks/

---

## 🗑️ Dead Code Encontrado

### 1. Components Tabs (Nunca Importados)

**Localização:** `components/homepage/tabs/`

| Arquivo | Tamanho | Última Modificação | Importado? |
|---------|---------|-------------------|-----------|
| `MediaTab.tsx` | 4.4KB | Jan 19 | ❌ NUNCA |
| `VotesTab.tsx` | 2.7KB | Jan 24 | ❌ NUNCA |
| `OpenGraphTab.tsx` | 6.4KB | Jan 19 | ❌ NUNCA |

**Impacto:** ~13KB de código dead.
**Ação:** Deletar.

---

### 2. Utils Libraries (Nunca Importados)

**Localização:** `lib/utils/`

| Arquivo | Tamanho | Última Modificação | Motivo |
|---------|---------|-------------------|--------|
| `imageUpload.ts` | 3.7KB | Sep 5 2025 | Substituído por hooks |
| `metadataMigration.ts` | 784B | Mar 9 | Script one-off antigo |
| `screenshotCapture.ts` | 7.2KB | Sep 5 2025 | Funcionalidade removida |
| `videoUtils.ts` | 927B | Sep 5 2025 | Substituído por `videoUploadUtils.ts` |
| `lazyLoad.tsx` | 784B | Mar 9 | Não usado (Next.js dynamic) |

**Impacto:** ~13KB de código dead.
**Ação:** Deletar.

---

### 3. Test Pages (Temp)

**Localização:** `app/`

- `app/test-dialog/` — Página de teste temporária (criada hoje, não commitada)

**Ação:** Deletar (já não está no git).

---

## ✅ False Positives (Código OK)

Arquivos que **parecem** dead mas **são usados**:

- `ErrorDemoPanel.tsx` → usado em SnapComposer + VideoUploader
- `loadingComponent.tsx` → usado em SpotList, Magazine, ProfilePage
- `VideoTimeline.tsx` → usado em VideoTrimModal + GIFMaker
- `CoinCreatorComposer.tsx` → usado em SnapList
- Todos os toast components → usados via CommunityToasts

---

## 📊 Outros Findings

### Console.logs
- **Total no projeto:** 2,960 console.* statements
- **Localização:** components/, app/, lib/
- **Ação:** Manter (necessário para debugging em dev)

### Código Comentado
- Nenhum arquivo com >20 linhas de comentários consecutivos
- **Ação:** N/A

---

## 💾 Tamanho Total de Dead Code

| Categoria | Arquivos | Tamanho |
|-----------|----------|---------|
| Components Tabs | 3 | ~13KB |
| Utils Libraries | 5 | ~13KB |
| Test Pages | 1 | ~2KB |
| **TOTAL** | **9** | **~28KB** |

---

## 🚀 Plano de Ação

1. ✅ Deletar `components/homepage/tabs/MediaTab.tsx`
2. ✅ Deletar `components/homepage/tabs/VotesTab.tsx`
3. ✅ Deletar `components/homepage/tabs/OpenGraphTab.tsx`
4. ✅ Deletar `lib/utils/imageUpload.ts`
5. ✅ Deletar `lib/utils/metadataMigration.ts`
6. ✅ Deletar `lib/utils/screenshotCapture.ts`
7. ✅ Deletar `lib/utils/videoUtils.ts`
8. ✅ Deletar `lib/utils/lazyLoad.tsx`
9. ✅ Deletar `app/test-dialog/` (temp page)

---

## ⚠️ Notas

- Nenhum false positive crítico detectado
- Arquivos antigos (Sep 2025) confirmam abandono
- Nenhum breaking change esperado (código nunca importado)
