'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Archive,
  CheckCircle2,
  Clapperboard,
  Eye,
  GripVertical,
  ImagePlus,
  Loader2,
  Pause,
  Pencil,
  Plus,
  Save,
  Download,
  Trash2,
  Upload,
  FileUp,
  X,
} from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAlert } from '@/components/ui/dialog-provider';
import { QueryState } from '@/components/query-state';

const SHOWCASE_SLUG = 'landing-inspiration-marquee';
const PRIMARY_ROW_KEY = 'cinematic';
const DEFAULT_PRIMARY_ROW: RowSetting = {
  key: PRIMARY_ROW_KEY,
  direction: 'left',
  durationSeconds: 42,
  gapPx: 18,
  enabled: true,
};

const inputClass =
  'mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20';
const btnPrimary =
  'inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50';
const btnSecondary =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50';
const btnOutlineBlue =
  'inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100';
const flatInputClass = inputClass.replace('mt-1 ', '');

function assetToEditForm(asset: Asset) {
  return {
    category: asset.category,
    videoUrl: asset.videoUrl ?? '',
    posterUrl: asset.posterUrl ?? '',
    titleZh: asset.titleI18n?.zh ?? '',
    titleEn: asset.titleI18n?.en ?? '',
    generationModel: asset.generationModel ?? '',
    generationPrompt: asset.generationPrompt ?? '',
    tags: asset.tags?.join(', ') ?? '',
    durationMs: asset.durationMs ? String(asset.durationMs) : '',
    width: asset.width ? String(asset.width) : '',
    height: asset.height ? String(asset.height) : '',
  };
}

const CATEGORIES = [
  'cinematic',
  'dance',
  'street-dance',
  'anime',
  '3d-toy',
  'animals',
  'fashion',
  'fantasy',
  'travel',
  'lyrics',
] as const;

type Localized = Record<string, string>;

interface RowSetting {
  key: string;
  direction: 'left' | 'right';
  durationSeconds: number;
  gapPx: number;
  enabled?: boolean;
}

interface ShowcaseSettings {
  rows: RowSetting[];
  pauseOnHover?: boolean;
  showLabels?: boolean;
}

function toSingleRowSettings(settings: ShowcaseSettings | null | undefined): ShowcaseSettings {
  const rows = settings?.rows ?? [];
  const existing = rows.find((row) => row.key === PRIMARY_ROW_KEY) ?? rows[0];
  return {
    ...settings,
    rows: [{ ...DEFAULT_PRIMARY_ROW, ...existing, key: PRIMARY_ROW_KEY, enabled: true }],
  };
}

interface Asset {
  id: string;
  slug: string;
  kind: string;
  sourceType: string;
  status: string;
  category: string;
  videoUrl: string | null;
  posterUrl: string | null;
  thumbnailUrl: string | null;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  titleI18n: Localized;
  descriptionI18n: Localized;
  generationProvider: string | null;
  generationModel: string | null;
  generationPrompt: string | null;
  tags: string[];
  createdAt: string;
}

interface ShowcaseItem {
  id: string;
  showcaseId: string;
  assetId: string;
  rowKey: string;
  sortOrder: number;
  status: string;
  labelI18n: Localized;
  subtitleI18n: Localized;
  badge: string | null;
  ctaLabelI18n: Localized;
  ctaHref: string | null;
  presetKey: string | null;
  startsAt: string | null;
  endsAt: string | null;
  asset?: Asset;
}

interface Showcase {
  id: string;
  slug: string;
  nameI18n: Localized;
  surface: string;
  status: string;
  settings: ShowcaseSettings;
  publishedVersion: number;
  publishedAt: string | null;
  startsAt: string | null;
  endsAt: string | null;
  updatedBy: string | null;
  updatedAt: string;
}

interface DetailResp {
  showcase: Showcase;
  items: ShowcaseItem[];
}

interface AssetListResp {
  items: Asset[];
  total: number;
  page: number;
  pageSize: number;
}

interface AuditRow {
  id: string;
  action: string;
  afterJson: Record<string, unknown> | null;
  createdAt: string;
  adminUser?: { id: string; email?: string; displayName?: string; name?: string } | null;
}

type TabKey = 'compose' | 'library' | 'history';

function fmtDuration(ms: number | null | undefined) {
  if (!ms || ms <= 0) return '—';
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}:${String(r).padStart(2, '0')}` : `${r}s`;
}

function promptSummary(prompt: string | null | undefined) {
  if (!prompt) return '—';
  return prompt.length > 80 ? `${prompt.slice(0, 80)}…` : prompt;
}

function SortableCard({
  item,
  onEdit,
  onRemove,
}: {
  item: ShowcaseItem;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.assetId,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const title =
    item.labelI18n?.zh ||
    item.labelI18n?.en ||
    item.asset?.titleI18n?.zh ||
    item.asset?.titleI18n?.en ||
    item.asset?.slug ||
    '未命名';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'w-44 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow',
        isDragging && 'opacity-80 shadow-md ring-2 ring-blue-400',
      )}
    >
      <div className="relative aspect-video bg-slate-100">
        {item.asset?.posterUrl || item.asset?.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.asset.posterUrl || item.asset.thumbnailUrl || ''}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-slate-400">无封面</div>
        )}
        <button
          type="button"
          className="absolute left-1 top-1 rounded bg-black/50 p-1 text-white cursor-grab"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="space-y-1 p-2">
        <div className="truncate text-xs font-medium text-slate-800">{title}</div>
        <div className="flex items-center justify-between text-[10px] text-slate-400">
          <span>{item.asset?.category ?? '—'}</span>
          <span>{fmtDuration(item.asset?.durationMs)}</span>
        </div>
        <div className="flex gap-1 pt-1">
          <button
            type="button"
            onClick={onEdit}
            className="flex-1 rounded-md border border-slate-200 px-1.5 py-1 text-[10px] font-medium text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
          >
            编辑
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="rounded-md border border-rose-200 px-1.5 py-1 text-[10px] text-rose-600 hover:bg-rose-50"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminMarketingShowcasePage() {
  const qc = useQueryClient();
  const alert = useAlert();
  const [tab, setTab] = useState<TabKey>('compose');
  const [draftSettings, setDraftSettings] = useState<ShowcaseSettings | null>(null);
  const [localItems, setLocalItems] = useState<ShowcaseItem[]>([]);
  const [editingItem, setEditingItem] = useState<ShowcaseItem | null>(null);
  const [pickerRow, setPickerRow] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);

  // library filters
  const [libCategory, setLibCategory] = useState('');
  const [libStatus, setLibStatus] = useState('');
  const [libSource, setLibSource] = useState('');
  const [libQ, setLibQ] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateKind, setGenerateKind] = useState<'video' | 'image'>('video');
  const [generateForm, setGenerateForm] = useState({
    category: 'cinematic',
    titleZh: '',
    titleEn: '',
    prompt: '',
    tags: '',
  });
  const [importForm, setImportForm] = useState({
    category: 'cinematic',
    videoUrl: '',
    posterUrl: '',
    titleZh: '',
    titleEn: '',
    generationModel: '',
    generationPrompt: '',
    tags: '',
    durationMs: '',
  });
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPoster, setUploadPoster] = useState<File | null>(null);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [editForm, setEditForm] = useState(() => assetToEditForm({} as Asset));

  const openAssetEditor = (asset: Asset) => {
    setEditingAsset(asset);
    setEditForm(assetToEditForm(asset));
  };

  const detailQuery = useQuery<DetailResp>({
    queryKey: ['admin', 'marketing', 'showcase', SHOWCASE_SLUG],
    queryFn: () => apiClient.get(`/admin/marketing/showcases/${SHOWCASE_SLUG}`) as any,
  });

  const assetsQuery = useQuery<AssetListResp>({
    queryKey: ['admin', 'marketing', 'assets', libCategory, libStatus, libSource, libQ],
    queryFn: () =>
      apiClient.get('/admin/marketing/assets', {
        params: {
          category: libCategory || undefined,
          status: libStatus || undefined,
          sourceType: libSource || undefined,
          q: libQ || undefined,
          pageSize: 60,
        },
      }) as any,
    enabled: tab === 'library' || !!pickerRow,
  });

  const showcase = detailQuery.data?.showcase;
  const historyQuery = useQuery<AuditRow[]>({
    queryKey: ['admin', 'marketing', 'history', showcase?.id],
    queryFn: () =>
      apiClient.get(`/admin/marketing/showcases/${showcase!.id}/history`) as any,
    enabled: tab === 'history' && !!showcase?.id,
  });

  useEffect(() => {
    if (!detailQuery.data) return;
    setDraftSettings(toSingleRowSettings(structuredClone(detailQuery.data.showcase.settings)));
    setLocalItems(structuredClone(detailQuery.data.items));
  }, [detailQuery.data]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const rows = draftSettings?.rows ?? [];
  const itemsByRow = useMemo(() => {
    const map = new Map<string, ShowcaseItem[]>();
    for (const row of rows) map.set(row.key, []);
    // 历史多轨道条目统一归入当前唯一主轨道展示，避免旧 rowKey（playful 等）卡片“消失”
    for (const item of localItems) {
      const targetKey = rows.some((r) => r.key === item.rowKey)
        ? item.rowKey
        : PRIMARY_ROW_KEY;
      const list = map.get(targetKey) ?? [];
      list.push({ ...item, rowKey: targetKey });
      map.set(targetKey, list);
    }
    for (const [, list] of map) list.sort((a, b) => a.sortOrder - b.sortOrder);
    return map;
  }, [localItems, rows]);

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ['admin', 'marketing'] });
  };

  const saveSettingsMutation = useMutation({
    mutationFn: () =>
      apiClient.patch(`/admin/marketing/showcases/${showcase!.id}`, {
        settings: toSingleRowSettings(draftSettings),
      }) as any,
    onSuccess: async () => {
      await invalidate();
      alert({ title: '已保存草稿', description: '投放位设置已更新', variant: 'success' });
    },
    onError: (err: any) =>
      alert({ title: '保存失败', description: err?.message || '请重试', variant: 'danger' }),
  });

  const saveRowMutation = useMutation({
    mutationFn: ({ rowKey, items }: { rowKey: string; items: ShowcaseItem[] }) =>
      apiClient.patch(`/admin/marketing/showcases/${showcase!.id}/items`, {
        rowKey,
        items: items.map((it, idx) => ({
          assetId: it.assetId,
          sortOrder: idx,
          status: it.status === 'published' ? 'published' : it.status || 'draft',
          labelI18n: it.labelI18n ?? {},
          subtitleI18n: it.subtitleI18n ?? {},
          badge: it.badge,
          ctaLabelI18n: it.ctaLabelI18n ?? {},
          ctaHref: it.ctaHref,
          presetKey: it.presetKey,
          startsAt: it.startsAt,
          endsAt: it.endsAt,
        })),
      }) as any,
    onSuccess: async () => {
      await invalidate();
    },
    onError: (err: any) =>
      alert({ title: '排序保存失败', description: err?.message || '请重试', variant: 'danger' }),
  });

  const publishMutation = useMutation({
    mutationFn: () => apiClient.post(`/admin/marketing/showcases/${showcase!.id}/publish`) as any,
    onSuccess: async () => {
      await invalidate();
      alert({ title: '已发布', description: '公开接口将返回最新编排', variant: 'success' });
    },
    onError: (err: any) =>
      alert({ title: '发布失败', description: err?.message || '请检查每轨至少 5 张卡', variant: 'danger' }),
  });

  const pauseMutation = useMutation({
    mutationFn: () => apiClient.post(`/admin/marketing/showcases/${showcase!.id}/pause`) as any,
    onSuccess: async () => {
      await invalidate();
      alert({ title: '已暂停', description: '公开接口将不再展示', variant: 'success' });
    },
  });

  const previewMutation = useMutation({
    mutationFn: () => apiClient.post(`/admin/marketing/showcases/${showcase!.id}/preview`) as any,
    onSuccess: (data) => {
      setPreviewData(data);
      setPreviewOpen(true);
    },
  });

  const createImportMutation = useMutation({
    mutationFn: () =>
      apiClient.post('/admin/marketing/assets', {
        kind: 'video',
        sourceType: 'imported',
        category: importForm.category,
        videoUrl: importForm.videoUrl,
        posterUrl: importForm.posterUrl || undefined,
        durationMs: importForm.durationMs ? Number(importForm.durationMs) : undefined,
        titleI18n: { zh: importForm.titleZh, en: importForm.titleEn },
        generationModel: importForm.generationModel || undefined,
        generationPrompt: importForm.generationPrompt || undefined,
        tags: importForm.tags
          ? importForm.tags
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
        status: 'review',
      }) as any,
    onSuccess: async () => {
      setCreateOpen(false);
      await qc.invalidateQueries({ queryKey: ['admin', 'marketing', 'assets'] });
      alert({ title: '已导入', description: '素材进入待审核', variant: 'success' });
    },
    onError: (err: any) =>
      alert({ title: '导入失败', description: err?.message || '请检查 URL', variant: 'danger' }),
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!uploadFile) throw new Error('请选择视频文件');
      const form = new FormData();
      form.append('file', uploadFile);
      if (uploadPoster) form.append('poster', uploadPoster);
      form.append('category', importForm.category);
      form.append('titleZh', importForm.titleZh);
      form.append('titleEn', importForm.titleEn);
      if (importForm.durationMs) form.append('durationMs', importForm.durationMs);
      if (importForm.tags) form.append('tags', importForm.tags);
      if (importForm.generationModel) form.append('generationModel', importForm.generationModel);
      if (importForm.generationPrompt) form.append('generationPrompt', importForm.generationPrompt);
      return apiClient.post('/admin/marketing/assets/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }) as any;
    },
    onSuccess: async () => {
      setCreateOpen(false);
      setUploadFile(null);
      setUploadPoster(null);
      await qc.invalidateQueries({ queryKey: ['admin', 'marketing', 'assets'] });
      alert({ title: '已上传', description: '素材进入待审核', variant: 'success' });
    },
    onError: (err: any) =>
      alert({ title: '上传失败', description: err?.message || '请重试', variant: 'danger' }),
  });

  const generateVideoMutation = useMutation({
    mutationFn: () =>
      apiClient.post('/admin/marketing/assets/generate', {
        category: generateForm.category,
        titleZh: generateForm.titleZh,
        titleEn: generateForm.titleEn,
        prompt: generateForm.prompt,
        tags: generateForm.tags
          ? generateForm.tags.split(',').map((tag) => tag.trim()).filter(Boolean)
          : [],
        durationSeconds: 6,
      }) as any,
    onSuccess: async () => {
      setGenerateOpen(false);
      setGenerateForm({ category: 'cinematic', titleZh: '', titleEn: '', prompt: '', tags: '' });
      await qc.invalidateQueries({ queryKey: ['admin', 'marketing', 'assets'] });
      alert({ title: '短片已生成', description: '已自动截取首帧封面，素材进入待审核', variant: 'success' });
    },
    onError: (err: any) =>
      alert({ title: '生成失败', description: err?.message || '请检查 AI 路由后重试', variant: 'danger' }),
  });

  const generateImageMutation = useMutation({
    mutationFn: () =>
      apiClient.post('/admin/marketing/assets/generate-image', {
        category: generateForm.category,
        titleZh: generateForm.titleZh,
        titleEn: generateForm.titleEn,
        prompt: generateForm.prompt,
        tags: generateForm.tags
          ? generateForm.tags.split(',').map((tag) => tag.trim()).filter(Boolean)
          : [],
        aspectRatio: '16:9',
      }) as any,
    onSuccess: async () => {
      setGenerateOpen(false);
      setGenerateForm({ category: 'cinematic', titleZh: '', titleEn: '', prompt: '', tags: '' });
      await qc.invalidateQueries({ queryKey: ['admin', 'marketing', 'assets'] });
      alert({ title: '图片已生成', description: '已保存到主存储，素材进入待审核', variant: 'success' });
    },
    onError: (err: any) =>
      alert({ title: '图片生成失败', description: err?.message || '请检查 AI 路由后重试', variant: 'danger' }),
  });

  const downloadJson = (filename: string, payload: unknown) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportAssetsMutation = useMutation({
    mutationFn: () => apiClient.get('/admin/marketing/export/assets') as Promise<any>,
    onSuccess: (raw: any) => {
      const payload = raw?.data ?? raw;
      const date = new Date().toISOString().slice(0, 10);
      downloadJson(`marketing-assets-all-${date}.json`, payload);
      alert({
        title: '已导出',
        description: `共 ${payload?.assets?.length ?? 0} 条素材（不含媒体文件本体）`,
        variant: 'success',
      });
    },
    onError: (err: any) =>
      alert({ title: '导出失败', description: err?.message || '请稍后重试', variant: 'danger' }),
  });

  const importTransferMutation = useMutation({
    mutationFn: (payload: unknown) =>
      apiClient.post('/admin/marketing/import', payload) as Promise<any>,
    onSuccess: async (raw: any) => {
      const result = raw?.data ?? raw;
      await qc.invalidateQueries({ queryKey: ['admin', 'marketing', 'assets'] });
      alert({
        title: '导入完成（追加）',
        description: `新增 ${result?.assetsCreated ?? 0} 条素材${
          result?.assetsSkipped
            ? `，跳过 ${result.assetsSkipped} 条已存在 slug`
            : ''
        }`,
        variant: 'success',
      });
    },
    onError: (err: any) =>
      alert({
        title: '导入失败',
        description: err?.response?.data?.message || err?.message || '请检查 JSON 格式',
        variant: 'danger',
      }),
  });

  const handleImportFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? '');
        const payload = JSON.parse(text);
        importTransferMutation.mutate(payload);
      } catch {
        alert({ title: '导入失败', description: '无法解析 JSON 文件', variant: 'danger' });
      }
    };
    reader.readAsText(file);
  };

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/admin/marketing/assets/${id}/approve`) as any,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'marketing', 'assets'] }),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/admin/marketing/assets/${id}/archive`) as any,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'marketing', 'assets'] }),
  });

  const generatePosterMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/admin/marketing/assets/${id}/generate-poster`) as any,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['admin', 'marketing', 'assets'] });
      alert({ title: '封面已生成', description: '已自动截取视频第一帧作为默认封面', variant: 'success' });
    },
    onError: (err: any) =>
      alert({ title: '封面生成失败', description: err?.message || '请检查视频地址后重试', variant: 'danger' }),
  });

  const updateAssetMutation = useMutation({
    mutationFn: () =>
      apiClient.patch(`/admin/marketing/assets/${editingAsset!.id}`, {
        category: editForm.category,
        videoUrl: editForm.videoUrl.trim() || null,
        posterUrl: editForm.posterUrl.trim() || null,
        durationMs: editForm.durationMs ? Number(editForm.durationMs) : null,
        width: editForm.width ? Number(editForm.width) : null,
        height: editForm.height ? Number(editForm.height) : null,
        titleI18n: { zh: editForm.titleZh, en: editForm.titleEn },
        generationModel: editForm.generationModel.trim() || null,
        generationPrompt: editForm.generationPrompt.trim() || null,
        tags: editForm.tags
          ? editForm.tags
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
      }) as any,
    onSuccess: async () => {
      setEditingAsset(null);
      await qc.invalidateQueries({ queryKey: ['admin', 'marketing', 'assets'] });
      alert({ title: '已保存', description: '素材信息已更新', variant: 'success' });
    },
    onError: (err: any) =>
      alert({ title: '保存失败', description: err?.message || '请重试', variant: 'danger' }),
  });

  const persistRow = (rowKey: string, nextItems: ShowcaseItem[]) => {
    const reindexed = nextItems.map((it, idx) => ({ ...it, sortOrder: idx, rowKey }));
    setLocalItems((prev) => [
      ...prev.filter((it) => it.rowKey !== rowKey),
      ...reindexed,
    ]);
    if (showcase) {
      saveRowMutation.mutate({ rowKey, items: reindexed });
    }
  };

  const onDragEnd = (rowKey: string) => (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const list = [...(itemsByRow.get(rowKey) ?? [])];
    const oldIndex = list.findIndex((i) => i.assetId === active.id);
    const newIndex = list.findIndex((i) => i.assetId === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    persistRow(rowKey, arrayMove(list, oldIndex, newIndex));
  };

  const addAssetToRow = (rowKey: string, asset: Asset) => {
    const list = itemsByRow.get(rowKey) ?? [];
    if (list.some((i) => i.assetId === asset.id)) {
      alert({ title: '已存在', description: '同一轨道不能重复放置同一素材', variant: 'warning' });
      return;
    }
    const next: ShowcaseItem = {
      id: `tmp-${asset.id}`,
      showcaseId: showcase!.id,
      assetId: asset.id,
      rowKey,
      sortOrder: list.length,
      status: 'draft',
      labelI18n: asset.titleI18n ?? {},
      subtitleI18n: {},
      badge: null,
      ctaLabelI18n: {},
      ctaHref: null,
      presetKey: null,
      startsAt: null,
      endsAt: null,
      asset,
    };
    persistRow(rowKey, [...list, next]);
    setPickerRow(null);
  };

  const saveItemMeta = () => {
    if (!editingItem) return;
    const list = (itemsByRow.get(editingItem.rowKey) ?? []).map((it) =>
      it.assetId === editingItem.assetId ? editingItem : it,
    );
    persistRow(editingItem.rowKey, list);
    setEditingItem(null);
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      draft: 'bg-slate-100 text-slate-600',
      review: 'bg-blue-50 text-blue-700',
      scheduled: 'bg-amber-50 text-amber-700',
      published: 'bg-emerald-50 text-emerald-700',
      paused: 'bg-orange-50 text-orange-700',
      archived: 'bg-rose-50 text-rose-700',
      approved: 'bg-emerald-50 text-emerald-700',
      processing: 'bg-violet-50 text-violet-700',
    };
    const labels: Record<string, string> = {
      draft: '草稿',
      review: '待审核',
      scheduled: '已排期',
      published: '已发布',
      paused: '已暂停',
      archived: '已归档',
      approved: '已通过',
      processing: '处理中',
    };
    return (
      <span
        className={cn(
          'rounded-full px-2.5 py-0.5 text-xs font-medium',
          map[status] || map.draft,
        )}
      >
        {labels[status] ?? status}
      </span>
    );
  };

  return (
    <div className="admin-page">
      <div className="admin-page-inner w-full">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600">
            <Clapperboard className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">营销素材与首页灵感跑马灯</h1>
            <p className="mt-1 text-sm text-slate-500">
              投放位{' '}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                {SHOWCASE_SLUG}
              </code>
              {showcase && (
                <>
                  {' · '}版本 v{showcase.publishedVersion}
                  {showcase.publishedAt
                    ? ` · 上次发布 ${new Date(showcase.publishedAt).toLocaleString()}`
                    : ' · 尚未发布'}
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showcase && statusBadge(showcase.status)}
          <button
            type="button"
            disabled={!showcase || previewMutation.isPending}
            onClick={() => previewMutation.mutate()}
            className={btnSecondary}
          >
            <Eye className="h-4 w-4" /> Preview
          </button>
          <button
            type="button"
            disabled={!showcase || saveSettingsMutation.isPending}
            onClick={() => saveSettingsMutation.mutate()}
            className={btnSecondary}
          >
            <Save className="h-4 w-4" /> Save draft
          </button>
          <button
            type="button"
            disabled={!showcase || publishMutation.isPending}
            onClick={() => publishMutation.mutate()}
            className={btnPrimary}
          >
            {publishMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Publish
          </button>
          <button
            type="button"
            disabled={!showcase || pauseMutation.isPending || showcase?.status !== 'published'}
            onClick={() => pauseMutation.mutate()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-sm font-medium text-orange-700 transition-colors hover:bg-orange-100 disabled:opacity-50"
          >
            <Pause className="h-4 w-4" /> Pause
          </button>
        </div>
      </div>

      <div className="inline-flex gap-1 rounded-xl border border-slate-200 bg-slate-100/80 p-1">
        {(
          [
            ['compose', '跑马灯编排'],
            ['library', '素材库'],
            ['history', '发布历史'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              tab === key
                ? 'bg-white text-blue-700 shadow-sm ring-1 ring-blue-100'
                : 'text-slate-500 hover:text-slate-700',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <QueryState
        isLoading={detailQuery.isLoading}
        isError={detailQuery.isError}
        error={detailQuery.error}
      >
        {tab === 'compose' && draftSettings && (
          <div className="space-y-4">
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-800">全局展示设置</h2>
              <p className="mt-1 text-xs text-slate-400">保存草稿后生效，发布时一并上线</p>
              <div className="mt-3 flex flex-wrap gap-6">
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    checked={draftSettings.pauseOnHover !== false}
                    onChange={(e) =>
                      setDraftSettings({ ...draftSettings, pauseOnHover: e.target.checked })
                    }
                  />
                  Hover 暂停滚动
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    checked={draftSettings.showLabels !== false}
                    onChange={(e) =>
                      setDraftSettings({ ...draftSettings, showLabels: e.target.checked })
                    }
                  />
                  显示卡片标题
                </label>
              </div>
            </section>

            {rows.map((row, rowIdx) => {
              const rowItems = itemsByRow.get(row.key) ?? [];
              const needsMore = row.enabled !== false && rowItems.length < 5;
              return (
                <section
                  key={row.key}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                >
                  <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-600 text-xs font-bold text-white">
                        {rowIdx + 1}
                      </span>
                      <span className="text-sm font-semibold text-slate-800">首页灵感跑马灯</span>
                      {needsMore && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                          还需 {5 - rowItems.length} 张
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'text-xs font-medium',
                          needsMore ? 'text-amber-600' : 'text-slate-400',
                        )}
                      >
                        {rowItems.length} 张卡
                      </span>
                      <button
                        type="button"
                        onClick={() => setPickerRow(row.key)}
                        className={btnOutlineBlue}
                      >
                        <Plus className="h-3.5 w-3.5" /> 从素材库添加
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3 p-4">
                  <div className="flex flex-wrap items-end gap-3">
                    <label className="text-xs font-medium text-slate-500">
                      方向
                      <select
                        className={`${inputClass} w-28`}
                        value={row.direction}
                        onChange={(e) => {
                          const next = structuredClone(draftSettings);
                          next.rows[rowIdx].direction = e.target.value as 'left' | 'right';
                          setDraftSettings(next);
                        }}
                      >
                        <option value="left">left</option>
                        <option value="right">right</option>
                      </select>
                    </label>
                    <label className="text-xs font-medium text-slate-500">
                      循环时长(s)
                      <input
                        type="number"
                        className={`${inputClass} w-24`}
                        value={row.durationSeconds}
                        onChange={(e) => {
                          const next = structuredClone(draftSettings);
                          next.rows[rowIdx].durationSeconds = Number(e.target.value) || 40;
                          setDraftSettings(next);
                        }}
                      />
                    </label>
                    <label className="text-xs font-medium text-slate-500">
                      间距(px)
                      <input
                        type="number"
                        className={`${inputClass} w-20`}
                        value={row.gapPx}
                        onChange={(e) => {
                          const next = structuredClone(draftSettings);
                          next.rows[rowIdx].gapPx = Number(e.target.value) || 18;
                          setDraftSettings(next);
                        }}
                      />
                    </label>
                  </div>

                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={onDragEnd(row.key)}
                  >
                    <SortableContext
                      items={rowItems.map((i) => i.assetId)}
                      strategy={horizontalListSortingStrategy}
                    >
                      <div className="flex min-h-[148px] gap-3 overflow-x-auto rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-3 pb-2">
                        {rowItems.map((item) => (
                          <SortableCard
                            key={item.assetId}
                            item={item}
                            onEdit={() => setEditingItem(structuredClone(item))}
                            onRemove={() =>
                              persistRow(
                                row.key,
                                rowItems.filter((i) => i.assetId !== item.assetId),
                              )
                            }
                          />
                        ))}
                        {rowItems.length === 0 && (
                          <div className="flex h-32 w-full flex-col items-center justify-center gap-1 text-sm text-slate-400">
                            <Plus className="h-5 w-5 text-blue-300" />
                            拖入或添加至少 5 张已审核视频
                          </div>
                        )}
                      </div>
                    </SortableContext>
                  </DndContext>
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {tab === 'library' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <label className="text-xs font-medium text-slate-500">
                分类
                <select
                  className={`${inputClass} w-36`}
                  value={libCategory}
                  onChange={(e) => setLibCategory(e.target.value)}
                >
                  <option value="">全部</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium text-slate-500">
                状态
                <select
                  className={`${inputClass} w-32`}
                  value={libStatus}
                  onChange={(e) => setLibStatus(e.target.value)}
                >
                  <option value="">全部</option>
                  {['draft', 'review', 'approved', 'archived', 'processing'].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium text-slate-500">
                来源
                <select
                  className={`${inputClass} w-32`}
                  value={libSource}
                  onChange={(e) => setLibSource(e.target.value)}
                >
                  <option value="">全部</option>
                  <option value="imported">imported</option>
                  <option value="uploaded">uploaded</option>
                  <option value="generated">generated</option>
                </select>
              </label>
              <label className="min-w-[180px] flex-1 text-xs font-medium text-slate-500">
                搜索
                <input
                  className={inputClass}
                  value={libQ}
                  onChange={(e) => setLibQ(e.target.value)}
                  placeholder="slug / 标题 / 提示词"
                />
              </label>
              <button type="button" onClick={() => setCreateOpen(true)} className={btnPrimary}>
                <Plus className="h-4 w-4" /> 导入 / 上传
              </button>
              <button
                type="button"
                onClick={() => setGenerateOpen(true)}
                className={btnSecondary}
              >
                Generate
              </button>
              <button
                type="button"
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'application/json,.json';
                  input.onchange = () => handleImportFile(input.files?.[0] ?? null);
                  input.click();
                }}
                disabled={importTransferMutation.isPending}
                className={btnSecondary}
                title="追加导入素材 JSON（不覆盖已有 slug）"
              >
                {importTransferMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileUp className="h-4 w-4" />
                )}
                导入
              </button>
              <button
                type="button"
                onClick={() => exportAssetsMutation.mutate()}
                disabled={exportAssetsMutation.isPending}
                className={btnSecondary}
                title="导出素材库全部素材元数据（不含媒体文件）"
              >
                {exportAssetsMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                导出
              </button>
            </div>

            <QueryState
              isLoading={assetsQuery.isLoading}
              isError={assetsQuery.isError}
              error={assetsQuery.error}
            >
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                {(assetsQuery.data?.items ?? []).map((asset) => (
                  <div
                    key={asset.id}
                    className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm"
                  >
                    <div className="aspect-video bg-slate-100">
                      {asset.posterUrl || asset.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={asset.posterUrl || asset.thumbnailUrl || ''}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-slate-400">
                          无封面
                        </div>
                      )}
                    </div>
                    <div className="space-y-1.5 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate text-sm font-medium text-slate-800">
                          {asset.titleI18n?.zh || asset.titleI18n?.en || asset.slug}
                        </div>
                        {statusBadge(asset.status)}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {asset.category} · {fmtDuration(asset.durationMs)}
                        {asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ''}
                      </div>
                      <div className="text-[11px] text-slate-500 line-clamp-2">
                        {promptSummary(asset.generationPrompt)}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {asset.generationModel || asset.sourceType}
                      </div>
                      <div className="flex gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => openAssetEditor(asset)}
                          className="flex-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                        >
                          <span className="inline-flex items-center justify-center gap-1">
                            <Pencil className="h-3 w-3" />
                            编辑
                          </span>
                        </button>
                        {asset.kind === 'video' && !asset.posterUrl && !asset.thumbnailUrl && (
                          <button
                            type="button"
                            disabled={generatePosterMutation.isPending}
                            onClick={() => generatePosterMutation.mutate(asset.id)}
                            className="rounded-md border border-violet-200 bg-violet-50 px-2 py-1 text-[11px] font-medium text-violet-700 transition-colors hover:bg-violet-100 disabled:opacity-50"
                            title="自动截取视频第一帧作为封面"
                          >
                            {generatePosterMutation.isPending ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <ImagePlus className="h-3 w-3" />
                            )}
                          </button>
                        )}
                        {asset.status !== 'approved' && asset.status !== 'archived' && (
                          <button
                            type="button"
                            onClick={() => approveMutation.mutate(asset.id)}
                            className="flex-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700 transition-colors hover:bg-blue-100"
                          >
                            审核通过
                          </button>
                        )}
                        {asset.status !== 'archived' && (
                          <button
                            type="button"
                            onClick={() => archiveMutation.mutate(asset.id)}
                            title="归档"
                            className="rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-600 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Archive className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </QueryState>
          </div>
        )}

        {tab === 'history' && (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">版本 / 动作</th>
                  <th className="px-4 py-2.5">时间</th>
                  <th className="px-4 py-2.5">操作人</th>
                  <th className="px-4 py-2.5">条目数</th>
                </tr>
              </thead>
              <tbody>
                {(historyQuery.data ?? []).map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-4 py-2.5">
                      {row.action}
                      {typeof row.afterJson?.publishedVersion === 'number'
                        ? ` · v${row.afterJson.publishedVersion}`
                        : ''}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">
                      {row.adminUser?.displayName ||
                        row.adminUser?.name ||
                        row.adminUser?.email ||
                        '—'}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">
                      {typeof row.afterJson?.itemCount === 'number'
                        ? String(row.afterJson.itemCount)
                        : '—'}
                    </td>
                  </tr>
                ))}
                {!historyQuery.isLoading && (historyQuery.data?.length ?? 0) === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                      暂无发布记录
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </QueryState>

      {/* 素材选择抽屉 */}
      {pickerRow && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-[1px]">
          <div className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-sm font-semibold text-slate-800">
                添加素材到「<span className="text-blue-600">{pickerRow}</span>」
              </div>
              <button type="button" onClick={() => setPickerRow(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {(assetsQuery.data?.items ?? [])
                .filter((a) => a.status === 'approved' && a.kind === 'video')
                .map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => addAssetToRow(pickerRow, asset)}
                    className="flex w-full gap-3 rounded-xl border border-slate-200 p-2 text-left transition-colors hover:border-blue-200 hover:bg-blue-50/60"
                  >
                    <div className="h-14 w-20 shrink-0 overflow-hidden rounded-md bg-slate-100">
                      {asset.posterUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={asset.posterUrl} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {asset.titleI18n?.zh || asset.slug}
                      </div>
                      <div className="text-xs text-slate-400">
                        {asset.category} · {fmtDuration(asset.durationMs)}
                      </div>
                    </div>
                  </button>
                ))}
              {(assetsQuery.data?.items ?? []).filter((a) => a.status === 'approved').length ===
                0 && (
                <div className="py-10 text-center text-sm text-slate-400">
                  暂无已审核视频，请先在素材库导入并审核
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 卡片编辑抽屉 */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-[1px]">
          <div className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-sm font-semibold text-slate-800">编辑卡片</div>
              <button type="button" onClick={() => setEditingItem(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {(
                [
                  ['labelI18n', '标题'],
                  ['subtitleI18n', '副标题'],
                  ['ctaLabelI18n', 'CTA 文案'],
                ] as const
              ).map(([field, label]) => (
                <div key={field} className="space-y-1">
                  <div className="text-xs font-medium text-slate-600">{label}</div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      className={inputClass}
                      placeholder="中文"
                      value={editingItem[field]?.zh ?? ''}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          [field]: { ...(editingItem[field] ?? {}), zh: e.target.value },
                        })
                      }
                    />
                    <input
                      className={inputClass}
                      placeholder="English"
                      value={editingItem[field]?.en ?? ''}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          [field]: { ...(editingItem[field] ?? {}), en: e.target.value },
                        })
                      }
                    />
                  </div>
                </div>
              ))}
              <label className="block text-xs font-medium text-slate-500">
                Badge
                <input
                  className={inputClass}
                  value={editingItem.badge ?? ''}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, badge: e.target.value || null })
                  }
                />
              </label>
              <label className="block text-xs font-medium text-slate-500">
                CTA href（站内路径）
                <input
                  className={inputClass}
                  value={editingItem.ctaHref ?? ''}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, ctaHref: e.target.value || null })
                  }
                />
              </label>
              <label className="block text-xs font-medium text-slate-500">
                preset_key
                <input
                  className={inputClass}
                  value={editingItem.presetKey ?? ''}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, presetKey: e.target.value || null })
                  }
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs font-medium text-slate-500">
                  开始
                  <input
                    type="datetime-local"
                    className={inputClass}
                    value={
                      editingItem.startsAt
                        ? new Date(editingItem.startsAt).toISOString().slice(0, 16)
                        : ''
                    }
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        startsAt: e.target.value ? new Date(e.target.value).toISOString() : null,
                      })
                    }
                  />
                </label>
                <label className="block text-xs font-medium text-slate-500">
                  结束
                  <input
                    type="datetime-local"
                    className={inputClass}
                    value={
                      editingItem.endsAt
                        ? new Date(editingItem.endsAt).toISOString().slice(0, 16)
                        : ''
                    }
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        endsAt: e.target.value ? new Date(e.target.value).toISOString() : null,
                      })
                    }
                  />
                </label>
              </div>
              <label className="block text-xs font-medium text-slate-500">
                状态
                <select
                  className={inputClass}
                  value={editingItem.status}
                  onChange={(e) => setEditingItem({ ...editingItem, status: e.target.value })}
                >
                  {['draft', 'scheduled', 'published', 'paused'].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="border-t border-slate-200 bg-slate-50 p-4">
              <button type="button" onClick={saveItemMeta} className={`${btnPrimary} w-full py-2`}>
                保存卡片
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑素材弹层 */}
      {editingAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-[1px]">
          <div className="max-h-[90vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="text-sm font-semibold text-slate-800">编辑素材</div>
                <div className="mt-0.5 text-xs text-slate-400">{editingAsset.slug}</div>
              </div>
              <button
                type="button"
                onClick={() => setEditingAsset(null)}
                className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <label className="block text-xs font-medium text-slate-500">
              分类
              <select
                className={inputClass}
                value={editForm.category}
                onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                className={flatInputClass}
                placeholder="标题中文"
                value={editForm.titleZh}
                onChange={(e) => setEditForm({ ...editForm, titleZh: e.target.value })}
              />
              <input
                className={flatInputClass}
                placeholder="Title EN"
                value={editForm.titleEn}
                onChange={(e) => setEditForm({ ...editForm, titleEn: e.target.value })}
              />
            </div>
            <input
              className={flatInputClass}
              placeholder="video_url"
              value={editForm.videoUrl}
              onChange={(e) => setEditForm({ ...editForm, videoUrl: e.target.value })}
            />
            <input
              className={flatInputClass}
              placeholder="poster_url"
              value={editForm.posterUrl}
              onChange={(e) => setEditForm({ ...editForm, posterUrl: e.target.value })}
            />
            <input
              className={flatInputClass}
              placeholder="generation_model"
              value={editForm.generationModel}
              onChange={(e) => setEditForm({ ...editForm, generationModel: e.target.value })}
            />
            <textarea
              className={`${flatInputClass} resize-none`}
              rows={3}
              placeholder="generation_prompt"
              value={editForm.generationPrompt}
              onChange={(e) => setEditForm({ ...editForm, generationPrompt: e.target.value })}
            />
            <div className="grid grid-cols-3 gap-2">
              <input
                className={flatInputClass}
                placeholder="时长 ms"
                value={editForm.durationMs}
                onChange={(e) => setEditForm({ ...editForm, durationMs: e.target.value })}
              />
              <input
                className={flatInputClass}
                placeholder="宽"
                value={editForm.width}
                onChange={(e) => setEditForm({ ...editForm, width: e.target.value })}
              />
              <input
                className={flatInputClass}
                placeholder="高"
                value={editForm.height}
                onChange={(e) => setEditForm({ ...editForm, height: e.target.value })}
              />
            </div>
            <input
              className={flatInputClass}
              placeholder="tags，逗号分隔"
              value={editForm.tags}
              onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
            />
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setEditingAsset(null)}
                className={`${btnSecondary} flex-1 py-2`}
              >
                取消
              </button>
              <button
                type="button"
                disabled={updateAssetMutation.isPending}
                onClick={() => updateAssetMutation.mutate()}
                className={`${btnPrimary} flex-1 py-2`}
              >
                {updateAssetMutation.isPending ? '保存中…' : '保存修改'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI 生成短片 */}
      {generateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-lg space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
              <div className="text-sm font-semibold text-slate-800">生成宣传素材</div>
                <div className="mt-0.5 text-xs text-slate-400">
                  {generateKind === 'image'
                    ? '静态图 · 16:9 · 自动保存到主存储'
                    : '6 秒 · 16:9 · 自动截取第一帧封面'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGenerateOpen(false)}
                className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <label className="block text-xs font-medium text-slate-500">
              素材类型
              <select
                className={inputClass}
                value={generateKind}
                onChange={(e) => setGenerateKind(e.target.value as 'video' | 'image')}
              >
                <option value="video">宣传短片（6 秒）</option>
                <option value="image">静态宣传图（16:9）</option>
              </select>
            </label>
            <label className="block text-xs font-medium text-slate-500">
              分类
              <select
                className={inputClass}
                value={generateForm.category}
                onChange={(e) => setGenerateForm({ ...generateForm, category: e.target.value })}
              >
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                className={flatInputClass}
                placeholder="标题中文"
                value={generateForm.titleZh}
                onChange={(e) => setGenerateForm({ ...generateForm, titleZh: e.target.value })}
              />
              <input
                className={flatInputClass}
                placeholder="Title EN"
                value={generateForm.titleEn}
                onChange={(e) => setGenerateForm({ ...generateForm, titleEn: e.target.value })}
              />
            </div>
            <textarea
              className={`${flatInputClass} resize-none`}
              rows={6}
              placeholder={generateKind === 'image' ? '描述场景、主体、光影与情绪。品牌文字和 Logo 请留给后期叠加。' : '描述动态、镜头、光影与情绪。品牌文字和 Logo 请留给后期叠加。'}
              value={generateForm.prompt}
              onChange={(e) => setGenerateForm({ ...generateForm, prompt: e.target.value })}
            />
            <input
              className={flatInputClass}
              placeholder="标签，逗号分隔（可选）"
              value={generateForm.tags}
              onChange={(e) => setGenerateForm({ ...generateForm, tags: e.target.value })}
            />
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setGenerateOpen(false)} className={`${btnSecondary} flex-1 py-2`}>
                取消
              </button>
              <button
                type="button"
                disabled={!generateForm.prompt.trim() || generateVideoMutation.isPending || generateImageMutation.isPending}
                onClick={() => (generateKind === 'image' ? generateImageMutation.mutate() : generateVideoMutation.mutate())}
                className={`${btnPrimary} flex-1 py-2`}
              >
                {generateVideoMutation.isPending || generateImageMutation.isPending
                  ? '生成中…'
                  : generateKind === 'image'
                    ? '生成图片'
                    : '生成短片'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 创建素材弹层 */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-lg space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="text-sm font-semibold text-slate-800">导入 / 上传素材</div>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <label className="block text-xs font-medium text-slate-500">
              分类
              <select
                className={inputClass}
                value={importForm.category}
                onChange={(e) => setImportForm({ ...importForm, category: e.target.value })}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                className={flatInputClass}
                placeholder="标题中文"
                value={importForm.titleZh}
                onChange={(e) => setImportForm({ ...importForm, titleZh: e.target.value })}
              />
              <input
                className={flatInputClass}
                placeholder="Title EN"
                value={importForm.titleEn}
                onChange={(e) => setImportForm({ ...importForm, titleEn: e.target.value })}
              />
            </div>
            <input
              className={inputClass.replace('mt-1 ', '')}
              placeholder="video_url（URL 导入）"
              value={importForm.videoUrl}
              onChange={(e) => setImportForm({ ...importForm, videoUrl: e.target.value })}
            />
            <input
              className={inputClass.replace('mt-1 ', '')}
              placeholder="poster_url（可选，留空自动截取第一帧）"
              value={importForm.posterUrl}
              onChange={(e) => setImportForm({ ...importForm, posterUrl: e.target.value })}
            />
            <input
              className={inputClass.replace('mt-1 ', '')}
              placeholder="generation_model（可选）"
              value={importForm.generationModel}
              onChange={(e) => setImportForm({ ...importForm, generationModel: e.target.value })}
            />
            <textarea
              className={`${flatInputClass} resize-none`}
              rows={2}
              placeholder="generation_prompt 摘要（可选，不向前台暴露）"
              value={importForm.generationPrompt}
              onChange={(e) => setImportForm({ ...importForm, generationPrompt: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                className={flatInputClass}
                placeholder="时长 ms"
                value={importForm.durationMs}
                onChange={(e) => setImportForm({ ...importForm, durationMs: e.target.value })}
              />
              <input
                className={flatInputClass}
                placeholder="tags,逗号分隔"
                value={importForm.tags}
                onChange={(e) => setImportForm({ ...importForm, tags: e.target.value })}
              />
            </div>
            <div className="space-y-2 rounded-xl border border-dashed border-blue-200 bg-blue-50/40 p-3">
              <div className="flex items-center gap-1 text-xs font-medium text-blue-700">
                <Upload className="h-3.5 w-3.5" /> 或上传文件
              </div>
              <label className="block text-xs text-slate-500">
                视频文件
                <input
                  type="file"
                  accept="video/*"
                  className="mt-1 block w-full text-xs file:mr-2 file:rounded-md file:border-0 file:bg-blue-600 file:px-2 file:py-1 file:text-xs file:font-medium file:text-white"
                  onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                />
              </label>
              <label className="block text-xs text-slate-500">
                封面图（可选，留空自动截取第一帧）
                <input
                  type="file"
                  accept="image/*"
                  className="mt-1 block w-full text-xs file:mr-2 file:rounded-md file:border-0 file:bg-blue-600 file:px-2 file:py-1 file:text-xs file:font-medium file:text-white"
                  onChange={(e) => setUploadPoster(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={!importForm.videoUrl || createImportMutation.isPending}
                onClick={() => createImportMutation.mutate()}
                className={`${btnSecondary} flex-1 py-2`}
              >
                URL 导入
              </button>
              <button
                type="button"
                disabled={!uploadFile || uploadMutation.isPending}
                onClick={() => uploadMutation.mutate()}
                className={`${btnPrimary} flex-1 py-2`}
              >
                {uploadMutation.isPending ? '上传中…' : '上传创建'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[1px]">
          <div className="max-h-[80vh] w-full max-w-3xl overflow-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="text-sm font-semibold text-slate-800">草稿预览 payload</div>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <pre className="overflow-auto rounded-xl bg-slate-900 p-4 text-xs text-blue-200">
              {JSON.stringify(previewData, null, 2)}
            </pre>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
