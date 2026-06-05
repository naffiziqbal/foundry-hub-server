export const PRODUCT_IMPORT_QUEUE = 'product-import';

export interface ProductImportJob {
  productId: string;
  url: string;
  /** Recipient for the "import complete" notification (the designer). */
  userId: string;
}
