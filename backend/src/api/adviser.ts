
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { AdviserService } from "../services/adviser";

const app = new Hono();

const adviserRequestSchema = z.object({
  target: z.object({
    name: z.string(),
    domain: z.string(),
    avg_ads_to_content_ratio: z.number(),
    avg_page_weight: z.number(),
    avg_ad_refresh: z.number(),
    reseller_count: z.number(),
    id_absorption_rate: z.number(),
    avg_cpu: z.number(),
    avg_ads_in_view: z.number(),
  }),
  benchmark: z.object({
    name: z.string(),
    domain: z.string(),
    avg_ads_to_content_ratio: z.number(),
    avg_page_weight: z.number(),
    avg_ad_refresh: z.number(),
    reseller_count: z.number(),
    id_absorption_rate: z.number(),
    avg_cpu: z.number(),
    avg_ads_in_view: z.number(),
  }),
  language: z.string().optional(),
});

app.post(
  "/analyze",
  zValidator("json", adviserRequestSchema),
  async (c) => {
    const { target, benchmark, language } = c.req.valid("json");

    try {
      const report = await AdviserService.generateReport(target, benchmark, language);
      return c.json({ report });
    } catch (error) {
      console.error("Adviser API Error:", error);
      return c.json({ error: "Failed to generate report" }, 500);
    }
  }
);

export default app;
