import path from "node:path";

import type { Request, RequestHandler, Response } from "express";

import type { AppConfig } from "../config/AppConfig.js";
import { asObject } from "../lib/payloadParsers.js";
import { renderTemplate } from "../lib/template.js";
import type { ComplianceService } from "../services/ComplianceService.js";
import type { GuidelineService } from "../services/GuidelineService.js";
import type { DeterministicRuleService } from "../services/DeterministicRuleService.js";
import type { AnalysisSetSummaryDto, DeterministicRuleRecord } from "../types/compliance.js";
import { BaseController, toErrorMessage } from "./BaseController.js";

interface GuidelineUpdateBody {
  markdown?: unknown;
}

const RULE_TYPE_LABELS: Record<string, string> = {
  font_size: "Font size",
  font_color: "Font color",
  font_family: "Font family",
  forbidden_text: "Forbidden text",
};

export class ComplianceController extends BaseController {
  constructor(
    private readonly complianceService: ComplianceService,
    private readonly guidelineService: GuidelineService,
    private readonly ruleService: DeterministicRuleService,
    private readonly config: AppConfig,
  ) {
    super();
  }

  // --- Deterministic rules --------------------------------------------------

  get handleRulesPage(): RequestHandler {
    return this.pageHandler(async (req: Request, res: Response) => {
      const auth = this.requireAuthUser(req);
      const rules = await this.ruleService.list();
      const ctx = {
        title: "Brand Check — Deterministic Rules",
        ...this.userTemplateData(auth.user),
        rules_html: ComplianceController.renderRulesHtml(rules),
      };
      const html = await renderTemplate(path.join(this.config.templateDir, "rules.hbs"), ctx);
      res.status(200).set("Content-Type", "text/html; charset=utf-8").send(html);
    });
  }

  get handleListRules(): RequestHandler {
    return this.jsonHandler(async (_req: Request, res: Response) => {
      const rules = await this.ruleService.list();
      res.status(200).json({ success: true, data: { rules } });
    });
  }

  get handleCreateRule(): RequestHandler {
    return this.jsonHandler(async (req: Request, res: Response) => {
      try {
        this.requireAuthUser(req);
        const rule = await this.ruleService.create(asObject(req.body));
        res.status(200).json({ success: true, data: { rule } });
      } catch (error: unknown) {
        res.status(400).json({ success: false, message: toErrorMessage(error, "Could not save rule") });
      }
    });
  }

  get handleUpdateRule(): RequestHandler {
    return this.jsonHandler(async (req: Request, res: Response) => {
      try {
        this.requireAuthUser(req);
        const rule = await this.ruleService.update(this.toInt(req.params.id), asObject(req.body));
        res.status(200).json({ success: true, data: { rule } });
      } catch (error: unknown) {
        res.status(400).json({ success: false, message: toErrorMessage(error, "Could not update rule") });
      }
    });
  }

  get handleDeleteRule(): RequestHandler {
    return this.jsonHandler(async (req: Request, res: Response) => {
      try {
        this.requireAuthUser(req);
        await this.ruleService.remove(this.toInt(req.params.id));
        res.status(200).json({ success: true, data: { id: this.toInt(req.params.id) } });
      } catch (error: unknown) {
        res.status(400).json({ success: false, message: toErrorMessage(error, "Could not delete rule") });
      }
    });
  }

  private static ruleSummary(rule: DeterministicRuleRecord): string {
    const scope = rule.scope === "any" ? "any text" : `${rule.scope} text`;
    switch (rule.ruleType) {
      case "font_size":
        return `${scope} must be ${rule.numberValue}pt`;
      case "font_color":
        return `${scope} must be #${rule.textValue}`;
      case "font_family":
        return `${scope} must use font “${rule.textValue}”`;
      case "forbidden_text":
        return `must not contain “${rule.textValue}”`;
      default:
        return rule.ruleType;
    }
  }

  private static renderRulesHtml(rules: DeterministicRuleRecord[]): string {
    if (rules.length === 0) {
      return '<p class="rules__empty">No deterministic rules yet. Add one above.</p>';
    }
    return rules
      .map((r) => {
        const type = RULE_TYPE_LABELS[r.ruleType] ?? r.ruleType;
        const fix = r.autoFix ? "auto-fix" : "flag only";
        const esc = ComplianceController.escapeHtml;
        const data = [
          `data-id="${r.id}"`,
          `data-rule-type="${esc(r.ruleType)}"`,
          `data-scope="${esc(r.scope)}"`,
          `data-number="${r.numberValue ?? ""}"`,
          `data-text="${esc(r.textValue ?? "")}"`,
          `data-severity="${esc(r.severity)}"`,
          `data-autofix="${r.autoFix ? "1" : "0"}"`,
          `data-name="${esc(r.name ?? "")}"`,
        ].join(" ");
        return `
          <li class="rules__item" ${data}>
            <span class="rules__type">${esc(type)}</span>
            <span class="rules__desc">${esc(ComplianceController.ruleSummary(r))}</span>
            <span class="rules__tag rules__tag--${r.severity}">${esc(r.severity)}</span>
            <span class="rules__tag">${fix}</span>
            <button class="btn btn--ghost rules__edit" type="button" data-id="${r.id}">Edit</button>
            <button class="btn btn--ghost rules__delete" type="button" data-id="${r.id}">Delete</button>
          </li>`;
      })
      .join("");
  }

  // --- Pages ----------------------------------------------------------------

  get handleCompliancePage(): RequestHandler {
    return this.pageHandler(async (req: Request, res: Response) => {
      const auth = this.requireAuthUser(req);
      const ctx = {
        title: "Brand Check - slotm",
        ...this.userTemplateData(auth.user),
        max_upload_mb: String(Math.floor(this.config.maxPptxUploadSize / (1024 * 1024))),
      };
      const html = await renderTemplate(path.join(this.config.templateDir, "compliance.hbs"), ctx);
      res.status(200).set("Content-Type", "text/html; charset=utf-8").send(html);
    });
  }

  get handleHistoryPage(): RequestHandler {
    return this.pageHandler(async (req: Request, res: Response) => {
      const auth = this.requireAuthUser(req);
      const sets = await this.complianceService.listSets(auth.user.id);
      const ctx = {
        title: "Brand Check — My Uploads",
        ...this.userTemplateData(auth.user),
        compliance_sets_html: ComplianceController.renderSetsHtml(sets),
      };
      const html = await renderTemplate(path.join(this.config.templateDir, "history.hbs"), ctx);
      res.status(200).set("Content-Type", "text/html; charset=utf-8").send(html);
    });
  }

  private static escapeHtml(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  private static renderSetsHtml(sets: AnalysisSetSummaryDto[]): string {
    if (sets.length === 0) {
      return '<p class="history__empty">No uploads yet. <a href="/compliance">Upload a deck</a> to get started.</p>';
    }
    return sets
      .map((s) => {
        const date = new Date(s.createdAt).toLocaleString();
        const statusClass = `history__status--${s.status.replace(/[^a-z]/gi, "")}`;
        const open =
          s.status === "reviewing" || s.status === "applied"
            ? `<a class="btn btn--primary" href="/compliance?set=${s.id}">Open</a>`
            : `<a class="btn btn--ghost" href="/compliance?set=${s.id}">View</a>`;
        return `
          <li class="history__item" data-id="${s.id}">
            <div class="history__info">
              <span class="history__title">${ComplianceController.escapeHtml(s.title)}</span>
              <span class="history__meta">${date} · ${s.slideCount} slides</span>
            </div>
            <span class="history__status ${statusClass}">${ComplianceController.escapeHtml(s.status)}</span>
            ${open}
            <button class="btn btn--ghost history__delete" type="button" data-id="${s.id}">Delete</button>
          </li>`;
      })
      .join("");
  }

  get handleGuidelinesPage(): RequestHandler {
    return this.pageHandler(async (req: Request, res: Response) => {
      const auth = this.requireAuthUser(req);
      const record = await this.guidelineService.getRecord();
      const ctx = {
        title: "Brand Guidelines - slotm",
        ...this.userTemplateData(auth.user),
        guidelines_markdown: record?.markdown ?? "",
        guidelines_updated_at: record ? new Date(record.updatedAt).toLocaleString() : "never",
      };
      const html = await renderTemplate(path.join(this.config.templateDir, "guidelines.hbs"), ctx);
      res.status(200).set("Content-Type", "text/html; charset=utf-8").send(html);
    });
  }

  // --- Compliance API -------------------------------------------------------

  get handleUpload(): RequestHandler {
    return this.jsonHandler(async (req: Request, res: Response) => {
      try {
        const auth = this.requireAuthUser(req);
        const file = req.file;
        if (!file) {
          res.status(400).json({ success: false, message: "No PowerPoint file uploaded" });
          return;
        }
        const setId = await this.complianceService.createSetFromUpload(
          auth.user.id,
          file.path,
          file.originalname,
          file.size,
        );
        res.status(200).json({ success: true, data: { setId } });
      } catch (error: unknown) {
        res.status(400).json({ success: false, message: toErrorMessage(error, "Upload failed") });
      }
    });
  }

  get handleAnalyze(): RequestHandler {
    return this.jsonHandler(async (req: Request, res: Response) => {
      try {
        const auth = this.requireAuthUser(req);
        const setId = this.toInt(req.params.setId);
        // Kick off analysis but respond once it completes (client polls status meanwhile).
        await this.complianceService.analyze(auth.user.id, setId);
        res.status(200).json({ success: true, data: { setId } });
      } catch (error: unknown) {
        res.status(400).json({ success: false, message: toErrorMessage(error, "Analysis failed") });
      }
    });
  }

  get handleRescanAi(): RequestHandler {
    return this.jsonHandler(async (req: Request, res: Response) => {
      try {
        const auth = this.requireAuthUser(req);
        const setId = this.toInt(req.params.setId);
        await this.complianceService.rescanAi(auth.user.id, setId);
        res.status(200).json({ success: true, data: { setId } });
      } catch (error: unknown) {
        res.status(400).json({ success: false, message: toErrorMessage(error, "Re-scan failed") });
      }
    });
  }

  get handleGetReview(): RequestHandler {
    return this.jsonHandler(async (req: Request, res: Response) => {
      try {
        const auth = this.requireAuthUser(req);
        const setId = this.toInt(req.params.setId);
        const review = await this.complianceService.getReview(auth.user.id, setId);
        res.status(200).json({ success: true, data: review });
      } catch (error: unknown) {
        res.status(404).json({ success: false, message: toErrorMessage(error, "Not found") });
      }
    });
  }

  get handleAcceptFlag(): RequestHandler {
    return this.flagDecision("accepted");
  }

  get handleRejectFlag(): RequestHandler {
    return this.flagDecision("rejected");
  }

  private flagDecision(status: "accepted" | "rejected"): RequestHandler {
    return this.jsonHandler(async (req: Request, res: Response) => {
      try {
        const auth = this.requireAuthUser(req);
        const flagId = this.toInt(req.params.id);
        await this.complianceService.setFlagDecision(auth.user.id, flagId, status);
        res.status(200).json({ success: true, data: { id: flagId, status } });
      } catch (error: unknown) {
        res.status(400).json({ success: false, message: toErrorMessage(error, "Update failed") });
      }
    });
  }

  get handleApply(): RequestHandler {
    return this.jsonHandler(async (req: Request, res: Response) => {
      try {
        const auth = this.requireAuthUser(req);
        const setId = this.toInt(req.params.setId);
        const result = await this.complianceService.applyCorrections(auth.user.id, setId);
        res.status(200).json({ success: true, data: result });
      } catch (error: unknown) {
        res.status(400).json({ success: false, message: toErrorMessage(error, "Apply failed") });
      }
    });
  }

  get handleListSets(): RequestHandler {
    return this.jsonHandler(async (req: Request, res: Response) => {
      const auth = this.requireAuthUser(req);
      const sets = await this.complianceService.listSets(auth.user.id);
      res.status(200).json({ success: true, data: { sets } });
    });
  }

  get handleDeleteSet(): RequestHandler {
    return this.jsonHandler(async (req: Request, res: Response) => {
      try {
        const auth = this.requireAuthUser(req);
        const setId = this.toInt(req.params.setId);
        await this.complianceService.deleteSet(auth.user.id, setId);
        res.status(200).json({ success: true, data: { id: setId } });
      } catch (error: unknown) {
        res.status(400).json({ success: false, message: toErrorMessage(error, "Delete failed") });
      }
    });
  }

  get handleClaudeStatus(): RequestHandler {
    return this.jsonHandler(async (_req: Request, res: Response) => {
      const status = await this.complianceService.claudeStatus();
      res.status(200).json({ success: true, data: status });
    });
  }

  // --- Guidelines API -------------------------------------------------------

  get handleGetGuidelines(): RequestHandler {
    return this.jsonHandler(async (_req: Request, res: Response) => {
      const record = await this.guidelineService.getRecord();
      res.status(200).json({
        success: true,
        data: { markdown: record?.markdown ?? "", updatedAt: record?.updatedAt ?? null },
      });
    });
  }

  get handleUpdateGuidelines(): RequestHandler {
    return this.jsonHandler(async (req: Request, res: Response) => {
      try {
        const auth = this.requireAuthUser(req);
        const payload = asObject<GuidelineUpdateBody>(req.body);
        const markdown = typeof payload.markdown === "string" ? payload.markdown : "";
        const record = await this.guidelineService.updateMarkdown(auth.user.id, markdown);
        res.status(200).json({ success: true, data: { updatedAt: record.updatedAt } });
      } catch (error: unknown) {
        res.status(400).json({ success: false, message: toErrorMessage(error, "Save failed") });
      }
    });
  }
}
