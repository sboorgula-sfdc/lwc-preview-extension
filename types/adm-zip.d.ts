declare module 'adm-zip' {
    export default class AdmZip {
        constructor(input?: string | Buffer);
        extractAllTo(targetPath: string, overwrite?: boolean): void;
        addLocalFile(localPath: string, zipPath?: string): void;
        writeZip(targetFileName: string): void;
    }
}
