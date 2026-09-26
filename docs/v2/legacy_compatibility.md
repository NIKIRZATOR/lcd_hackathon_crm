# Legacy compatibility

## Target

V2 uses `ProgramInstance`, its immutable workflow snapshot, organization-level framework contracts, program-level licenses, and the five canonical playbooks.

## Legacy

`UniversityInteraction`, historical 14-stage workflow versions, the `control` catalog entry, and the `materials_update` and `reactivation` templates remain to preserve existing records and Alembic history.

## Compatibility

Existing runtime instances continue to reference their historical workflow version. The legacy templates are archived and inactive, so they are not offered by the V2 master.

## Removal criteria

Legacy entities may be removed only after all active runtime instances and reports no longer reference them, data migration is verified, and API compatibility is explicitly retired.
