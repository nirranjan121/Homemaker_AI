export interface PreprocessResult {
    image_b64: string;
    width: number;
    height: number;
    scale_factor: number;
    mime_type: string;
}
export declare function preprocessImage(fileBuffer: Buffer): Promise<PreprocessResult>;
//# sourceMappingURL=preprocess.service.d.ts.map