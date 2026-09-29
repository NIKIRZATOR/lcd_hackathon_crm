import {
  BookOutlined,
  CheckSquareOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  SearchOutlined,
  SendOutlined,
  SettingOutlined,
  TeamOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Drawer,
  Dropdown,
  Form,
  Input,
  message,
  Modal,
  Spin,
  Tabs,
  Tree,
  Typography,
  Upload,
} from 'antd';
import type { UploadProps } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { useAuth } from '../auth';
import { ApiError, apiDownload, apiRequest } from '../api/client';
import styles from './DocumentationDrawer.module.scss';

type DocPage = {
  id: string;
  slug: string;
  title: string;
  route_pattern: string;
  parent_id: string | null;
  sort_order: number;
  content_markdown: string;
  source_file_id: string | null;
  updated_at: string;
};
type DocumentationImage = { id: string; file_id: string; markdown: string };

const Highlight = ({ value, query }: { value: string; query: string }) => {
  if (!query.trim()) return value;
  const parts = value.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'));
  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === query.toLowerCase() ? <mark key={index}>{part}</mark> : part,
      )}
    </>
  );
};

const MarkdownText = ({ value, query }: { value: string; query: string }) => (
  <>
    {value.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
      const isBold = part.startsWith('**') && part.endsWith('**');
      const text = isBold ? part.slice(2, -2) : part;
      return isBold ? (
        <strong key={index}>
          <Highlight value={text} query={query} />
        </strong>
      ) : (
        <Highlight key={index} value={text} query={query} />
      );
    })}
  </>
);

const DocumentationImageView = ({
  pageId,
  imageId,
  alt,
}: {
  pageId: string;
  imageId: string;
  alt: string;
}) => {
  const [src, setSrc] = useState<string>();
  useEffect(() => {
    let url: string | undefined;
    void apiDownload(`/api/documentation/pages/${pageId}/images/${imageId}`)
      .then((blob) => {
        url = URL.createObjectURL(blob);
        setSrc(url);
      })
      .catch(() => setSrc(undefined));
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [imageId, pageId]);
  return src ? (
    <img className={styles.image} src={src} alt={alt} />
  ) : (
    <Typography.Text type="secondary">Изображение недоступно.</Typography.Text>
  );
};

const Markdown = ({ value, query, pageId }: { value: string; query: string; pageId: string }) => (
  <article className={styles.article}>
    {value.split('\n').map((line, index) => {
      const image = line.match(/^!\[([^\]]*)\]\(doc-image:\/\/([^)]+)\)$/);
      if (image)
        return (
          <DocumentationImageView key={index} pageId={pageId} imageId={image[2]} alt={image[1]} />
        );
      if (line.startsWith('### '))
        return (
          <Typography.Title key={index} level={5}>
            <MarkdownText value={line.slice(4)} query={query} />
          </Typography.Title>
        );
      if (line.startsWith('## '))
        return (
          <Typography.Title key={index} level={4}>
            <MarkdownText value={line.slice(3)} query={query} />
          </Typography.Title>
        );
      if (line.startsWith('# '))
        return (
          <Typography.Title key={index} level={3}>
            <MarkdownText value={line.slice(2)} query={query} />
          </Typography.Title>
        );
      if (['---', '***', '___'].includes(line.trim()))
        return <hr className={styles.divider} key={index} />;
      if (line.startsWith('- '))
        return (
          <div className={styles.bullet} key={index}>
            <span>✓</span>
            <MarkdownText value={line.slice(2)} query={query} />
          </div>
        );
      if (!line.trim()) return <div className={styles.gap} key={index} />;
      return (
        <Typography.Paragraph key={index}>
          <MarkdownText value={line} query={query} />
        </Typography.Paragraph>
      );
    })}
  </article>
);

const DocumentationDrawer = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const { user } = useAuth();
  const location = useLocation();
  const [pages, setPages] = useState<DocPage[]>([]);
  const [selected, setSelected] = useState<DocPage>();
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('help');
  const [fullscreen, setFullscreen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [requestError, setRequestError] = useState<string>();
  const [error, setError] = useState<string>();
  const [editForm] = Form.useForm();
  const [treeEditing, setTreeEditing] = useState(false);
  const [renamingPage, setRenamingPage] = useState<DocPage>();
  const [deletingPage, setDeletingPage] = useState<DocPage>();
  const [addingSection, setAddingSection] = useState(false);
  const [sectionForm] = Form.useForm();
  const isAdmin = Boolean(user?.roles.includes('ADMIN'));
  const canManage = Boolean(user?.roles.some((role) => role === 'ADMIN' || role === 'MANAGER'));
  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const [loadedPages, routePage] = await Promise.all([
        apiRequest<DocPage[]>('/api/documentation/pages'),
        apiRequest<DocPage | null>(
          `/api/documentation/pages/for-route?route=${encodeURIComponent(location.pathname)}`,
        ),
      ]);
      setPages(loadedPages);
      setSelected(routePage ?? loadedPages[0]);
    } catch {
      setError('Не удалось загрузить документацию.');
    } finally {
      setLoading(false);
    }
  }, [location.pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load, open]);
  const visiblePages = useMemo(
    () =>
      search.trim()
        ? pages.filter((page) =>
            `${page.title} ${page.content_markdown}`.toLowerCase().includes(search.toLowerCase()),
          )
        : pages,
    [pages, search],
  );
  const sections = useMemo(
    () => [
      { title: 'Главная', route: '/home', icon: <QuestionCircleOutlined /> },
      { title: 'Организации', route: '/organizations', icon: <TeamOutlined /> },
      { title: 'Workflow', route: '/workflows', icon: <CheckSquareOutlined /> },
      { title: 'Отчёты', route: '/reports', icon: <FileTextOutlined /> },
      ...(canManage
        ? [{ title: 'Управление', route: '/management', icon: <SettingOutlined /> }]
        : []),
    ],
    [canManage],
  );
  const treeData = useMemo(() => {
    const systemSlugs = new Set([
      'v2',
      'home',
      'organizations',
      'workflows',
      'program-detail',
      'reports',
      'management',
    ]);
    const controls = (page: DocPage) =>
      treeEditing ? (
        <span className={styles.nodeControls}>
          <Button
            size="small"
            type="text"
            icon={<EditOutlined />}
            onClick={(event) => {
              event.stopPropagation();
              setRenamingPage(page);
            }}
          />
          <Button
            size="small"
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={(event) => {
              event.stopPropagation();
              setDeletingPage(page);
            }}
          />
        </span>
      ) : null;
    const systemNodes = sections.map((section) => {
      const page = visiblePages.find((item) => item.route_pattern === section.route);
      return {
        key: section.route,
        title: (
          <span>
            {section.title}
            {page && controls(page)}
          </span>
        ),
        icon: section.icon,
        disabled: !page,
      };
    });
    const additionalNodes = visiblePages
      .filter((page) => page.parent_id && !systemSlugs.has(page.slug))
      .map((page) => ({
        key: page.route_pattern,
        title: (
          <span>
            {page.title}
            {controls(page)}
          </span>
        ),
        icon: <BookOutlined />,
      }));
    return [...systemNodes, ...additionalNodes];
  }, [sections, treeEditing, visiblePages]);
  const uploadProps: UploadProps = {
    accept: '.md,.markdown,text/markdown',
    maxCount: 1,
    showUploadList: false,
    beforeUpload: async (file) => {
      if (!selected) return Upload.LIST_IGNORE;
      const data = new FormData();
      data.append('file', file);
      try {
        const page = await apiRequest<DocPage>(`/api/documentation/pages/${selected.id}/upload`, {
          method: 'POST',
          body: data,
        });
        setSelected(page);
        await load();
      } catch {
        setError('Не удалось загрузить Markdown-файл.');
      }
      return false;
    },
  };
  const imageUploadProps: UploadProps = {
    accept: 'image/png,image/jpeg,image/webp,image/gif',
    maxCount: 1,
    showUploadList: false,
    beforeUpload: async (file) => {
      if (!selected) return Upload.LIST_IGNORE;
      const data = new FormData();
      data.append('file', file);
      try {
        const image = await apiRequest<DocumentationImage>(
          `/api/documentation/pages/${selected.id}/images`,
          { method: 'POST', body: data },
        );
        const markdown = editForm.getFieldValue('content_markdown') || '';
        editForm.setFieldsValue({
          content_markdown: `${markdown}${markdown ? '\n\n' : ''}${image.markdown}`,
        });
        void message.success('Изображение добавлено в статью.');
      } catch {
        setError('Не удалось загрузить изображение.');
      }
      return false;
    },
  };
  const sectionIcon = selected?.route_pattern.includes('organizations') ? (
    <TeamOutlined />
  ) : selected?.route_pattern.includes('workflows') ? (
    <CheckSquareOutlined />
  ) : (
    <QuestionCircleOutlined />
  );
  return (
    <Drawer
      className={styles.drawer}
      closable={false}
      placement="right"
      width={fullscreen ? '100vw' : 560}
      open={open}
      onClose={() => {
        setFullscreen(false);
        onClose();
      }}
      styles={{ body: { padding: 0 } }}
    >
      <header className={styles.header}>
        <Typography.Title level={4}>Документация</Typography.Title>
        <span className={styles.headerActions}>
          <Button
            type="text"
            icon={fullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
            aria-label={fullscreen ? 'Свернуть документацию' : 'Развернуть документацию'}
            title={fullscreen ? 'Свернуть' : 'На весь экран'}
            onClick={() => setFullscreen((current) => !current)}
          />
          <Button
            type="text"
            icon={<CloseOutlined />}
            aria-label="Закрыть документацию"
            onClick={() => {
              setFullscreen(false);
              onClose();
            }}
          />
        </span>
      </header>
      <Tabs
        className={styles.tabs}
        activeKey={tab}
        onChange={setTab}
        items={[
          { key: 'help', label: 'Помощь' },
          {
            key: 'updates',
            label: (
              <span>
                Что нового <i className={styles.dot} />
              </span>
            ),
          },
        ]}
      />
      {tab !== 'help' ? (
        <div className={styles.comingSoon}>
          <BookOutlined />
          <Typography.Title level={4}>Что нового</Typography.Title>
          <Typography.Text type="secondary">
            Раздел будет наполнен в следующих обновлениях.
          </Typography.Text>
        </div>
      ) : (
        <>
          <div className={styles.search}>
            <Input
              prefix={<SearchOutlined />}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Поиск по документации..."
            />
          </div>
          {error && <Alert type="error" showIcon message={error} className={styles.alert} />}
          {loading ? (
            <div className={styles.loader}>
              <Spin />
            </div>
          ) : (
            <div className={styles.workspace}>
              <aside className={styles.treePane}>
                {isAdmin && (
                  <div className={styles.treeToolbar}>
                    <Typography.Text>Разделы</Typography.Text>
                    <Button
                      type={treeEditing ? 'primary' : 'text'}
                      size="small"
                      icon={<SettingOutlined />}
                      onClick={() => setTreeEditing(!treeEditing)}
                    />
                  </div>
                )}
                <Tree
                  showIcon
                  blockNode
                  selectedKeys={selected ? [selected.route_pattern] : []}
                  treeData={treeData}
                  onSelect={(keys) =>
                    setSelected(pages.find((page) => page.route_pattern === keys[0]))
                  }
                />
                {isAdmin && treeEditing && (
                  <Button
                    className={styles.addSectionButton}
                    icon={<PlusOutlined />}
                    block
                    onClick={() => {
                      sectionForm.resetFields();
                      setAddingSection(true);
                    }}
                  >
                    Добавить раздел
                  </Button>
                )}
              </aside>
              <main className={styles.content}>
                <div className={styles.breadcrumb}>
                  {sectionIcon} Помощь <span>›</span> {selected?.title ?? 'Раздел'}
                </div>
                {isAdmin && selected && (
                  <Dropdown
                    menu={{
                      items: [
                        { key: 'edit', label: 'Редактировать Markdown', icon: <EditOutlined /> },
                        {
                          key: 'upload',
                          label: (
                            <Upload {...uploadProps}>
                              <span>Заменить .md</span>
                            </Upload>
                          ),
                          icon: <UploadOutlined />,
                        },
                      ],
                      onClick: ({ key }) => {
                        if (key === 'edit') setEditOpen(true);
                      },
                    }}
                    trigger={['click']}
                  >
                    <Button
                      className={styles.settingsButton}
                      type="text"
                      icon={<SettingOutlined />}
                      aria-label="Настройки раздела"
                    />
                  </Dropdown>
                )}
                {selected ? (
                  <Markdown value={selected.content_markdown} query={search} pageId={selected.id} />
                ) : (
                  <Typography.Text type="secondary">
                    Раздел документации ещё не опубликован.
                  </Typography.Text>
                )}
              </main>
            </div>
          )}
          <footer className={styles.footer}>
            <Button
              block
              icon={<SendOutlined />}
              onClick={() => {
                setRequestError(undefined);
                setRequestOpen(true);
              }}
            >
              Создать обращение
            </Button>
          </footer>
        </>
      )}
      <Modal
        title="Редактирование раздела"
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <Form
          form={editForm}
          initialValues={{ title: selected?.title, content_markdown: selected?.content_markdown }}
          onFinish={async (values) => {
            if (!selected) return;
            const page = await apiRequest<DocPage>(`/api/documentation/pages/${selected.id}`, {
              method: 'PATCH',
              body: JSON.stringify(values),
            });
            setSelected(page);
            setEditOpen(false);
            await load();
          }}
        >
          <Form.Item name="title" label="Название" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="content_markdown" label="Markdown" rules={[{ required: true }]}>
            <Input.TextArea rows={14} />
          </Form.Item>
          <Upload {...imageUploadProps}>
            <Button icon={<UploadOutlined />}>Добавить изображение</Button>
          </Upload>
          <Button htmlType="submit" type="primary" style={{ marginLeft: 8 }}>
            Сохранить
          </Button>
        </Form>
      </Modal>
      <Modal
        title="Переименовать раздел"
        open={Boolean(renamingPage)}
        onCancel={() => setRenamingPage(undefined)}
        footer={null}
        destroyOnHidden
      >
        <Form
          initialValues={{ title: renamingPage?.title }}
          onFinish={async ({ title }) => {
            if (!renamingPage) return;
            await apiRequest(`/api/documentation/pages/${renamingPage.id}`, {
              method: 'PATCH',
              body: JSON.stringify({ title }),
            });
            setRenamingPage(undefined);
            await load();
          }}
        >
          <Form.Item name="title" label="Название" rules={[{ required: true, whitespace: true }]}>
            <Input autoFocus />
          </Form.Item>
          <Button type="primary" htmlType="submit">
            Сохранить
          </Button>
        </Form>
      </Modal>
      <Modal
        title="Удалить раздел?"
        open={Boolean(deletingPage)}
        onCancel={() => setDeletingPage(undefined)}
        okText="Удалить"
        okButtonProps={{ danger: true }}
        onOk={async () => {
          if (!deletingPage) return;
          await apiRequest(`/api/documentation/pages/${deletingPage.id}`, { method: 'DELETE' });
          if (selected?.id === deletingPage.id) setSelected(undefined);
          setDeletingPage(undefined);
          await load();
        }}
      >
        <Typography.Paragraph>
          Раздел «{deletingPage?.title}» будет удалён. Это действие нельзя отменить.
        </Typography.Paragraph>
      </Modal>
      <Modal
        title="Новый раздел"
        open={addingSection}
        onCancel={() => setAddingSection(false)}
        footer={null}
        destroyOnHidden
      >
        <Form
          form={sectionForm}
          onFinish={async ({ title }) => {
            const slug = `section-${Date.now()}`;
            const root = pages.find((page) => page.slug === 'home');
            const page = await apiRequest<DocPage>('/api/documentation/pages', {
              method: 'POST',
              body: JSON.stringify({
                slug,
                title,
                route_pattern: `/documentation/${slug}`,
                parent_id: root?.id ?? null,
                sort_order: Math.max(0, ...pages.map((item) => item.sort_order)) + 10,
                content_markdown: `# ${title}\n\n`,
              }),
            });
            setAddingSection(false);
            setSelected(page);
            await load();
          }}
        >
          <Form.Item
            name="title"
            label="Название раздела"
            rules={[{ required: true, whitespace: true, max: 255 }]}
          >
            <Input autoFocus placeholder="Например, Интеграции" />
          </Form.Item>
          <Button type="primary" htmlType="submit">
            Добавить
          </Button>
        </Form>
      </Modal>
      <Modal
        title="Обращение по документации"
        open={requestOpen}
        onCancel={() => !requestSubmitting && setRequestOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <Form
          onFinish={async (values) => {
            setRequestSubmitting(true);
            setRequestError(undefined);
            try {
              await apiRequest('/api/documentation/requests', {
                method: 'POST',
                body: JSON.stringify({ ...values, page_id: selected?.id ?? null }),
              });
              setRequestOpen(false);
              void message.success('Ваше обращение зарегистрировано.');
            } catch (caught) {
              const apiError = caught instanceof ApiError ? caught : undefined;
              setRequestError(
                apiError?.status === 401
                  ? 'Сессия истекла. Войдите в систему повторно.'
                  : apiError?.status === 403
                    ? 'Недостаточно прав для создания обращения.'
                    : apiError?.status === 422
                      ? 'Проверьте корректность темы и текста обращения.'
                      : 'Не удалось зарегистрировать обращение. Попробуйте ещё раз.',
              );
            } finally {
              setRequestSubmitting(false);
            }
          }}
        >
          <Form.Item name="subject" label="Тема" rules={[{ required: true, min: 3 }]}>
            <Input disabled={requestSubmitting} />
          </Form.Item>
          <Form.Item name="message" label="Сообщение" rules={[{ required: true, min: 3 }]}>
            <Input.TextArea rows={6} disabled={requestSubmitting} />
          </Form.Item>
          {requestError && (
            <Alert type="error" showIcon message={requestError} style={{ marginBottom: 16 }} />
          )}
          <Button htmlType="submit" type="primary" loading={requestSubmitting}>
            Отправить
          </Button>
        </Form>
      </Modal>
    </Drawer>
  );
};
export default DocumentationDrawer;
