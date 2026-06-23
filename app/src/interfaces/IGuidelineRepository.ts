export interface GuidelineRecord {
  id: number;
  slug: string;
  markdown: string;
  version: number;
  updatedAt: string;
}

export interface IGuidelineRepository {
  getBySlug(slug: string): Promise<GuidelineRecord | null>;
  upsert(slug: string, markdown: string, updatedBy: number | null): Promise<GuidelineRecord>;
}
