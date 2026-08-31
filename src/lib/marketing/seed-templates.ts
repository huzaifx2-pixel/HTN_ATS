import type { MarketingTemplateCategory } from "@prisma/client";
import type { EmailBlock } from "@/lib/marketing/types";

type SeedTemplate = {
  name: string;
  category: MarketingTemplateCategory;
  subject: string;
  designJson: EmailBlock[];
};

export const DEFAULT_MARKETING_TEMPLATES: SeedTemplate[] = [
  {
    name: "Job Blast — Featured Roles",
    category: "JOB_BLAST",
    subject: "New opportunities matching your profile",
    designJson: [
      { id: "1", type: "header", props: { title: "Headsbase Talent Network" } },
      {
        id: "2",
        type: "hero",
        props: { headline: "Exciting roles are waiting for you", subheadline: "Hand-picked opportunities from top employers" },
      },
      {
        id: "3",
        type: "text",
        content: "Hi {{FirstName}},\n\nWe identified several roles that align with your background. Explore your personalized matches below.",
      },
      { id: "4", type: "featured_jobs" },
      { id: "5", type: "button", props: { label: "View All Jobs", href: "{{ApplyLink}}" } },
      { id: "6", type: "footer", content: "You received this because you are in our talent network." },
    ],
  },
  {
    name: "Monthly Newsletter",
    category: "NEWSLETTER",
    subject: "Your monthly talent update from {{RecruiterName}}",
    designJson: [
      { id: "1", type: "header" },
      { id: "2", type: "text", content: "Hi {{FirstName}},\n\nHere's what's new this month in our talent community." },
      { id: "3", type: "text", content: "• Industry insights\n• Featured employers\n• Upcoming hiring events\n• Career resources" },
      { id: "4", type: "cta", props: { title: "Explore opportunities", label: "Browse Jobs", href: "#" } },
      { id: "5", type: "social", content: "Connect with us online", props: { linkedin: "#", twitter: "#", facebook: "#" } },
      { id: "6", type: "footer" },
    ],
  },
  {
    name: "Candidate Re-engagement",
    category: "REACTIVATION",
    subject: "We'd love to reconnect, {{FirstName}}",
    designJson: [
      { id: "1", type: "header" },
      {
        id: "2",
        type: "text",
        content: "Hi {{FirstName}},\n\nIt's been a while since we last connected. New roles have opened that may be a great fit for your experience at {{CurrentCompany}}.",
      },
      { id: "3", type: "featured_jobs" },
      { id: "4", type: "button", props: { label: "Update My Profile", href: "#" } },
      { id: "5", type: "footer" },
    ],
  },
  {
    name: "Hiring Event Invitation",
    category: "HIRING_EVENT",
    subject: "You're invited — Virtual Hiring Event",
    designJson: [
      { id: "1", type: "header" },
      { id: "2", type: "hero", props: { headline: "Virtual Hiring Event", subheadline: "Meet hiring managers live" } },
      { id: "3", type: "text", content: "Hi {{FirstName}},\n\nJoin us for a virtual hiring event featuring multiple employers and on-the-spot interview opportunities." },
      { id: "4", type: "button", props: { label: "Register Now", href: "#" } },
      { id: "5", type: "footer" },
    ],
  },
  {
    name: "Referral Campaign",
    category: "REFERRAL",
    subject: "Know someone great? Refer & earn",
    designJson: [
      { id: "1", type: "header" },
      { id: "2", type: "text", content: "Hi {{FirstName}},\n\nKnow a talented {{CurrentJobTitle}}? Refer them to our open roles and help us build exceptional teams." },
      { id: "3", type: "button", props: { label: "Refer a Candidate", href: "#" } },
      { id: "4", type: "footer" },
    ],
  },
];
