import { FileOutlined } from '@ant-design/icons';
import { Button, Checkbox, Input, Tag } from 'antd';

import StageFactTiles from '../../workflow/components/StageFactTiles';
import formStyles from '../../workflow/components/FirstMeetingStage.module.scss';
import tileStyles from '../../workflow/components/ContactSearchStage.module.scss';
import { DOC_TYPES, FACT_CATALOG } from './catalog';
import styles from './PlaybookEditorPage.module.scss';
import type { EditorStage, StageBlock } from './types';

const PreviewBlock = ({ block }: { block: StageBlock }) => {
  const required = block.required ? ' *' : '';
  if (block.kind === 'contact') {
    return (
      <div>
        <p className={tileStyles.blockTitle}>{block.title}{required}</p>
        <StageFactTiles tiles={[
          { kind: 'person', label: 'Ответственный', value: 'Не заполнено' },
          { kind: 'phone', label: 'Телефон', value: 'Не заполнено' },
          { kind: 'mail', label: 'Почта', value: 'Не заполнено' },
          { kind: 'due', label: 'Роль', value: block.flags?.role ? 'Контакт площадки' : 'Не требуется' },
        ]} />
      </div>
    );
  }
  if (block.kind === 'fields') {
    const facts = (block.fields ?? []).map((field) => FACT_CATALOG.find((item) => item.id === field.factId));
    return (
      <div>
        <p className={tileStyles.blockTitle}>{block.title}{required}</p>
        <div className={tileStyles.factGrid}>
          {(facts.length ? facts : [{ label: 'Поле не выбрано' }]).map((fact, index) => (
            <div key={fact?.id ?? index} className={tileStyles.factCell}>
              <span>{fact?.label ?? 'Поле'}</span>
              <b>Не заполнено</b>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (block.kind === 'checklist') {
    return (
      <div>
        <p className={tileStyles.blockTitle}>{block.title}</p>
        <div className={tileStyles.list}>
          {(block.items ?? []).map((item) => (
            <div key={item.id} className={tileStyles.row}>
              <Checkbox checked={false} disabled>{item.text}{item.required ? ' *' : ''}{item.mode === 'auto' ? ` · авто${item.factId ? `: ${FACT_CATALOG.find((fact) => fact.id === item.factId)?.label ?? item.factId}` : ''}` : ''}</Checkbox>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (block.kind === 'comment') {
    return (
      <div className={formStyles.field}>
        <span>{block.title}{required}</span>
        <Input.TextArea disabled autoSize={{ minRows: 2, maxRows: 4 }} value="" placeholder={block.hint || 'Комментарий'} />
      </div>
    );
  }
  if (block.kind === 'confirm') {
    return <Checkbox disabled>{block.title || 'Подтверждаю'}{required}</Checkbox>;
  }
  if (block.kind === 'document' || block.kind === 'documents') {
    const slots = block.kind === 'document' ? [{ id: block.id, title: block.title, required: block.required !== false, docType: block.docType ?? '' }] : (block.slots ?? []);
    return (
      <div>
        <p className={tileStyles.blockTitle}>{block.title}</p>
        <div className={formStyles.fileSlot}>
          {slots.map((slot) => (
            <div key={slot.id} className={formStyles.fileCard}>
              <span className={formStyles.fileMark}><FileOutlined /></span>
              <span className={formStyles.fileName}>{slot.title}{slot.required ? ' *' : ''}</span>
              <span className={formStyles.fileMeta}>{DOC_TYPES.find((item) => item.id === slot.docType)?.label ?? 'Тип не выбран'} · файл не загружен</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (block.kind === 'contract') {
    return (
      <div>
        <p className={tileStyles.blockTitle}>{block.title}</p>
        <div className={tileStyles.factGrid}>
          {block.flags?.number !== false && <div className={tileStyles.factCell}><span>Номер</span><b>Не заполнено</b></div>}
          {block.flags?.date !== false && <div className={tileStyles.factCell}><span>Дата</span><b>Не заполнено</b></div>}
          {block.flags?.file !== false && <div className={tileStyles.factCell}><span>Файл</span><b>Не загружен</b></div>}
        </div>
      </div>
    );
  }
  if (block.kind === 'license') {
    return (
      <div>
        <p className={tileStyles.blockTitle}>{block.title}</p>
        <div className={tileStyles.factGrid}>
          {block.flags?.number && <div className={tileStyles.factCell}><span>Номер</span><b>Не заполнено</b></div>}
          {block.flags?.until && <div className={tileStyles.factCell}><span>Срок</span><b>Не заполнено</b></div>}
          {block.flags?.file && <div className={tileStyles.factCell}><span>Файл</span><b>Не загружен</b></div>}
        </div>
      </div>
    );
  }
  if (block.kind === 'access') {
    return (
      <div>
        <p className={tileStyles.blockTitle}>{block.title}</p>
        <div className={tileStyles.factGrid}>
          {block.flags?.transfer && <div className={tileStyles.factCell}><span>Передача</span><b>Не заполнено</b></div>}
          {block.flags?.access && <div className={tileStyles.factCell}><span>Доступ</span><b>Не заполнено</b></div>}
          {block.flags?.file && <div className={tileStyles.factCell}><span>Акт</span><b>Не загружен</b></div>}
        </div>
      </div>
    );
  }
  if (block.kind === 'teacher') {
    return (
      <div>
        <p className={tileStyles.blockTitle}>{block.title}</p>
        <StageFactTiles tiles={[
          { kind: 'person', label: 'Преподаватель', value: 'Не выбран' },
          { kind: 'due', label: 'Дата обучения', value: block.flags?.trainedOn ? 'Не заполнено' : 'Не требуется' },
        ]} />
      </div>
    );
  }
  if (block.kind === 'curriculum') {
    return (
      <div>
        <p className={tileStyles.blockTitle}>{block.title}</p>
        {block.flags?.file && (
          <div className={formStyles.fileCard}>
            <span className={formStyles.fileMark}><FileOutlined /></span>
            <span className={formStyles.fileName}>Файл плана не загружен</span>
            <span className={formStyles.fileMeta}>Ожидает загрузки</span>
          </div>
        )}
        {block.flags?.comment && <Input.TextArea disabled autoSize placeholder="Комментарий согласования" value="" />}
      </div>
    );
  }
  if (block.kind === 'lms' || block.kind === 'site') {
    return (
      <div>
        <p className={tileStyles.blockTitle}>{block.title}</p>
        <div className={tileStyles.factGrid}>
          {block.kind === 'lms' && block.flags?.students !== false && <div className={tileStyles.factCell}><span>Студенты</span><b>Нет данных</b></div>}
          {block.kind === 'lms' && block.flags?.applications && <div className={tileStyles.factCell}><span>Заявки</span><b>Нет данных</b></div>}
          {block.flags?.signal !== false && <div className={tileStyles.factCell}><span>Последний сигнал</span><b>Нет данных</b></div>}
          <div className={tileStyles.factCell}><span>Источник</span><b>{block.kind === 'lms' ? 'LMS' : 'Сайт'}</b></div>
        </div>
      </div>
    );
  }
  return <p className={styles.hint}>{block.title}</p>;
};

const StagePreview = ({ stage }: { stage: EditorStage }) => (
  <div className={tileStyles.root}>
    <p className={formStyles.lead}>{stage.description || 'Описание этапа не задано'}</p>
    <div className={styles.previewMeta}>
      <Tag>SLA: {stage.slaDays ?? 'не задан'} дн.</Tag>
      {stage.canSkip && <Tag>Можно пропустить</Tag>}
    </div>
    {stage.blocks.length === 0 && <p className={styles.hint}>В этапе пока нет блоков.</p>}
    <div className={styles.previewBlocks}>
      {stage.blocks.map((block) => <PreviewBlock key={block.id} block={block} />)}
    </div>
    <div className={styles.previewFooter}>
      {stage.catalogCode === 'control'
        ? <Tag>Постоянный контроль, этап не закрывается</Tag>
        : <Button type="primary" disabled>Закрыть этап</Button>}
    </div>
  </div>
);

export default StagePreview;