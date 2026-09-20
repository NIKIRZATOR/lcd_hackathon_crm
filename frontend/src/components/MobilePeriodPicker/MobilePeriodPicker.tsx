import { ArrowRightOutlined } from '@ant-design/icons';
import { Button, DatePicker } from 'antd';
import type { Dayjs } from 'dayjs';
import { useRef, useState } from 'react';

import styles from './MobilePeriodPicker.module.scss';

export type PeriodValue = [Dayjs, Dayjs] | null;

export type PeriodPreset = {
  label: string;
  value: [Dayjs, Dayjs];
};

type MobilePeriodPickerProps = {
  value?: PeriodValue;
  onChange?: (value: PeriodValue) => void;
  minDate: Dayjs;
  maxDate: Dayjs;
  presets: PeriodPreset[];
};

type OpenedPicker = 'start' | 'end' | null;

type DraftPeriodDate = {
  type: 'start' | 'end';
  date: Dayjs;
} | null;

const MobilePeriodPicker = ({
  value,
  onChange,
  minDate,
  maxDate,
  presets,
}: MobilePeriodPickerProps) => {
  const [openedPicker, setOpenedPicker] = useState<OpenedPicker>(null);
  const [draftDate, setDraftDate] = useState<DraftPeriodDate>(null);

  const nextPickerRef = useRef<OpenedPicker>(null);

  const startDate = draftDate?.type === 'end' ? null : (draftDate?.date ?? value?.[0] ?? null);

  const endDate = draftDate?.type === 'start' ? null : (draftDate?.date ?? value?.[1] ?? null);

  const handleStartChange = (date: Dayjs | null) => {
    if (!date) {
      nextPickerRef.current = null;
      setDraftDate(null);
      onChange?.(null);
      return;
    }

    if (draftDate?.type === 'end') {
      onChange?.([date, draftDate.date]);
      setDraftDate(null);
      return;
    }

    setDraftDate({
      type: 'start',
      date,
    });

    nextPickerRef.current = 'end';
  };

  const handleEndChange = (date: Dayjs | null) => {
    if (!date) {
      nextPickerRef.current = null;
      setDraftDate(null);
      onChange?.(null);
      return;
    }

    if (draftDate?.type === 'start') {
      onChange?.([draftDate.date, date]);
      setDraftDate(null);
      return;
    }

    setDraftDate({
      type: 'end',
      date,
    });

    nextPickerRef.current = 'start';
  };

  const handleOpenChange = (picker: 'start' | 'end', open: boolean) => {
    if (open) {
      setOpenedPicker(picker);
      return;
    }

    if (nextPickerRef.current) {
      const nextPicker = nextPickerRef.current;

      nextPickerRef.current = null;
      setOpenedPicker(nextPicker);

      return;
    }

    setOpenedPicker(null);
  };

  const handlePresetClick = (preset: PeriodPreset) => {
    nextPickerRef.current = null;

    setDraftDate(null);
    setOpenedPicker(null);

    onChange?.(preset.value);
  };

  const isPresetActive = (presetValue: PeriodValue) => {
    if (!value || !presetValue || draftDate) {
      return false;
    }

    return value[0].isSame(presetValue[0], 'day') && value[1].isSame(presetValue[1], 'day');
  };

  return (
    <div className={styles.period}>
      <div className={styles.period__input}>
        <DatePicker
          value={startDate}
          open={openedPicker === 'start'}
          onOpenChange={(open) => handleOpenChange('start', open)}
          onChange={handleStartChange}
          minDate={minDate}
          maxDate={draftDate?.type === 'end' ? draftDate.date : maxDate}
          format="DD.MM.YYYY"
          placeholder="Начало"
          inputReadOnly
          allowClear
          variant="borderless"
          getPopupContainer={(trigger) => trigger.parentElement ?? document.body}
          className={styles.period__date}
          classNames={{
            popup: {
              root: styles.period__popup,
            },
          }}
        />

        <ArrowRightOutlined className={styles.period__arrow} />

        <DatePicker
          value={endDate}
          open={openedPicker === 'end'}
          onOpenChange={(open) => handleOpenChange('end', open)}
          onChange={handleEndChange}
          minDate={draftDate?.type === 'start' ? draftDate.date : minDate}
          maxDate={maxDate}
          format="DD.MM.YYYY"
          placeholder="Конец"
          inputReadOnly
          allowClear
          variant="borderless"
          placement="bottomRight"
          getPopupContainer={(trigger) => trigger.parentElement ?? document.body}
          className={styles.period__date}
          classNames={{
            popup: {
              root: styles.period__popup,
            },
          }}
        />
      </div>

      <div className={styles.period__presets}>
        {presets.map((preset) => {
          const isActive = isPresetActive(preset.value);

          return (
            <Button
              key={preset.label}
              className={
                isActive
                  ? `${styles.period__preset} ${styles.period__preset_active}`
                  : styles.period__preset
              }
              onClick={() => handlePresetClick(preset)}
            >
              {preset.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
};

export default MobilePeriodPicker;
