/**
 * `.laserpack` (M16): the self-contained, zip-based project file format.
 * Barrel export — see `types.ts` for the schema, `create.ts` for the writer,
 * `open.ts` for the reader, and `zip.ts` for the fflate zip engine.
 */

export { createLibraryBackup, LIBRARY_BACKUP_FORMAT, LIBRARY_BACKUP_VERSION, openLibraryBackup, restoreLibraryBackupRecords } from './backup'
export type { BackupRestoreTarget, CreateLibraryBackupInput, LibraryBackupManifest, OpenedLibraryBackup, RestoreBackupResult } from './backup'
export { createProjectPack } from './create'
export type { CreateProjectPackInput, PackFontInput, PackModelInput } from './create'
export { bytesToDataUrl, decodeBase64, encodeBase64, extToMime, mimeToExt, parseDataUrl } from './dataUrl'
export type { ParsedDataUrl } from './dataUrl'
export { openProjectPack } from './open'
export type { OpenedFontBlob, OpenedModelBlob, OpenedProjectPack } from './open'
export { PACK_APP, PACK_FORMAT, PACK_REF_PREFIX, PACK_VERSION, PackError } from './types'
export type { PackAssetEntry, PackAssetKind, PackErrorCode, PackManifest } from './types'
export { MAX_PACK_ENTRIES, MAX_PACK_UNCOMPRESSED_BYTES, unzipEntries, zipEntries } from './zip'
