import { Injectable, Logger } from '@nestjs/common';
import PDFDocument from 'pdfkit';

export interface PdfProductRow {
  name: string;
  vendor?: string;
  manufacturer?: string;
  sku?: string;
  price?: number | null;
  currency?: string;
  dimensions?: string;
  approvalStatus: string;
  notes?: string;
  imageUrl?: string;
  specifications: { label: string; value: string }[];
  quantity: number;
}

export interface PdfRoomGroup {
  roomName: string;
  rows: PdfProductRow[];
}

export interface PdfScheduleData {
  projectName: string;
  clientName?: string;
  address?: string;
  scheduleName: string;
  scheduleType: string;
  generatedAt: string;
  groups: PdfRoomGroup[];
}

const COLORS = {
  ink: '#1a1a1a',
  muted: '#6b7280',
  line: '#e5e7eb',
  accent: '#0f766e',
  approved: '#15803d',
  rejected: '#b91c1c',
  pending: '#b45309',
};

/**
 * Renders a professional schedule PDF with pdfkit. Images are fetched from
 * their CDN URLs and embedded; failures degrade gracefully to a placeholder.
 */
@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  async render(data: PdfScheduleData): Promise<Buffer> {
    // Pre-fetch all images concurrently so layout stays synchronous
    const imageCache = await this.prefetchImages(data);

    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 48,
        bufferPages: true,
        info: {
          Title: `${data.projectName} — ${data.scheduleName}`,
          Author: 'Foundry Hub',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c as Buffer));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      this.renderHeader(doc, data);

      for (const group of data.groups) {
        this.renderRoomHeading(doc, group.roomName);
        for (const row of group.rows) {
          this.renderProductRow(doc, row, imageCache);
        }
      }

      if (data.groups.every((g) => g.rows.length === 0)) {
        doc
          .moveDown(2)
          .fontSize(11)
          .fillColor(COLORS.muted)
          .text('No products on this schedule yet.', { align: 'center' });
      }

      this.renderFooter(doc);
      doc.end();
    });
  }

  private async prefetchImages(
    data: PdfScheduleData,
  ): Promise<Map<string, Buffer>> {
    const urls = new Set<string>();
    data.groups.forEach((g) =>
      g.rows.forEach((r) => r.imageUrl && urls.add(r.imageUrl)),
    );
    const cache = new Map<string, Buffer>();
    await Promise.all(
      [...urls].map(async (url) => {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 5000);
          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(timer);
          if (!res.ok) return;
          const type = res.headers.get('content-type') ?? '';
          if (!/jpe?g|png/i.test(type)) return;
          const buf = Buffer.from(await res.arrayBuffer());
          cache.set(url, buf);
        } catch {
          /* skip unreadable images */
        }
      }),
    );
    return cache;
  }

  private renderHeader(doc: PDFKit.PDFDocument, data: PdfScheduleData) {
    doc
      .fillColor(COLORS.accent)
      .fontSize(9)
      .text('FOUNDRY HUB', { characterSpacing: 2 });
    doc
      .fillColor(COLORS.ink)
      .fontSize(22)
      .text(data.scheduleName, { continued: false });
    doc
      .fontSize(11)
      .fillColor(COLORS.muted)
      .text(
        `${this.titleCase(data.scheduleType)} Schedule · ${data.projectName}`,
      );

    const meta: string[] = [];
    if (data.clientName) meta.push(`Client: ${data.clientName}`);
    if (data.address) meta.push(data.address);
    meta.push(`Generated ${data.generatedAt}`);
    doc.moveDown(0.3).fontSize(9).fillColor(COLORS.muted).text(meta.join('  ·  '));

    doc.moveDown(0.6);
    this.hr(doc);
    doc.moveDown(0.6);
  }

  private renderRoomHeading(doc: PDFKit.PDFDocument, roomName: string) {
    if (doc.y > 720) doc.addPage();
    doc
      .moveDown(0.4)
      .fillColor(COLORS.accent)
      .fontSize(13)
      .text(roomName);
    doc.moveDown(0.2);
  }

  private renderProductRow(
    doc: PDFKit.PDFDocument,
    row: PdfProductRow,
    images: Map<string, Buffer>,
  ) {
    const rowHeight = 84;
    if (doc.y + rowHeight > 770) doc.addPage();

    const top = doc.y;
    const left = doc.page.margins.left;
    const imgSize = 64;
    const textX = left + imgSize + 14;
    const textWidth = doc.page.width - doc.page.margins.right - textX;

    // Image / placeholder
    const buf = row.imageUrl ? images.get(row.imageUrl) : undefined;
    if (buf) {
      try {
        doc.image(buf, left, top, {
          fit: [imgSize, imgSize],
          align: 'center',
          valign: 'center',
        });
      } catch {
        this.placeholderBox(doc, left, top, imgSize);
      }
    } else {
      this.placeholderBox(doc, left, top, imgSize);
    }

    // Name + status
    doc
      .fillColor(COLORS.ink)
      .fontSize(12)
      .text(row.name, textX, top, { width: textWidth - 90, ellipsis: true });

    this.statusBadge(doc, row.approvalStatus, top);

    // Vendor / manufacturer / sku line
    const subParts = [
      row.vendor && `Vendor: ${row.vendor}`,
      row.manufacturer && `Mfr: ${row.manufacturer}`,
      row.sku && `SKU: ${row.sku}`,
    ].filter(Boolean);
    doc
      .fontSize(8.5)
      .fillColor(COLORS.muted)
      .text(subParts.join('   ·   ') || ' ', textX, doc.y + 2, {
        width: textWidth,
      });

    // Price / dimensions / qty
    const facts = [
      row.price != null &&
        `${row.currency ?? 'USD'} ${Number(row.price).toFixed(2)}`,
      row.dimensions && row.dimensions,
      `Qty: ${row.quantity}`,
    ].filter(Boolean);
    doc
      .fontSize(9)
      .fillColor(COLORS.ink)
      .text(facts.join('   |   '), textX, doc.y + 1, { width: textWidth });

    // First couple of specs
    if (row.specifications.length) {
      const specLine = row.specifications
        .slice(0, 3)
        .map((s) => `${s.label}: ${s.value}`)
        .join('   ·   ');
      doc
        .fontSize(8)
        .fillColor(COLORS.muted)
        .text(specLine, textX, doc.y + 1, {
          width: textWidth,
          ellipsis: true,
        });
    }

    if (row.notes) {
      doc
        .fontSize(8)
        .fillColor(COLORS.muted)
        .text(`Notes: ${row.notes}`, textX, doc.y + 1, {
          width: textWidth,
          ellipsis: true,
        });
    }

    const bottom = Math.max(doc.y, top + imgSize) + 10;
    doc.y = bottom;
    this.hr(doc);
    doc.moveDown(0.4);
  }

  private statusBadge(doc: PDFKit.PDFDocument, status: string, top: number) {
    const color =
      status === 'approved'
        ? COLORS.approved
        : status === 'rejected'
          ? COLORS.rejected
          : COLORS.pending;
    const label = this.titleCase(status);
    const w = 70;
    const x = doc.page.width - doc.page.margins.right - w;
    doc
      .roundedRect(x, top, w, 16, 8)
      .fillColor(color)
      .opacity(0.12)
      .fill()
      .opacity(1);
    doc
      .fillColor(color)
      .fontSize(8)
      .text(label, x, top + 4, { width: w, align: 'center' });
  }

  private placeholderBox(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    size: number,
  ) {
    doc
      .roundedRect(x, y, size, size, 6)
      .fillColor('#f3f4f6')
      .fill()
      .fillColor(COLORS.muted)
      .fontSize(7)
      .text('No image', x, y + size / 2 - 4, { width: size, align: 'center' });
  }

  private hr(doc: PDFKit.PDFDocument) {
    doc
      .strokeColor(COLORS.line)
      .lineWidth(0.5)
      .moveTo(doc.page.margins.left, doc.y)
      .lineTo(doc.page.width - doc.page.margins.right, doc.y)
      .stroke();
  }

  private renderFooter(doc: PDFKit.PDFDocument) {
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      // The footer sits below the bottom margin; writing there normally
      // triggers pdfkit's auto-pagination and appends blank pages. Lift the
      // margin while stamping, and never line-break.
      const bottomMargin = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc
        .fontSize(8)
        .fillColor(COLORS.muted)
        .text(
          `Generated by Foundry Hub · Page ${i + 1} of ${range.count}`,
          doc.page.margins.left,
          doc.page.height - 32,
          {
            width:
              doc.page.width - doc.page.margins.left - doc.page.margins.right,
            align: 'center',
            lineBreak: false,
          },
        );
      doc.page.margins.bottom = bottomMargin;
    }
  }

  private titleCase(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
  }
}
