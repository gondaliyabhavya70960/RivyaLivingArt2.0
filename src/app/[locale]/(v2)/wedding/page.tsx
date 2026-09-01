import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { SectionHeading } from "@/components/storefront/section-heading";
import { Button } from "@/components/storefront/button";
import { Link } from "@/i18n/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  await params;
  return {
    title: "Wedding Art & Gifts — Rivya Living Art",
    description: "Premium event art, resin wedding gifts, and custom wedding tables.",
  };
}

export default async function WeddingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="flex flex-col min-h-screen pt-32 pb-16 bg-sand">
      <div className="u-shell">
        <SectionHeading eyebrow="Event Art" title="Wedding & Keepsakes" />
        <div className="mt-12 text-18 text-graphite max-w-3xl leading-relaxed">
          <p>
            Preserve your most precious memories in crystal-clear liquid glass. Our wedding collection
            focuses on premium floral preservation, luxury wedding keepsakes, and custom event installations.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8">
           <div className="aspect-[4/3] bg-mineral flex items-center justify-center p-8 text-center text-ink">
              [ Floral Preservation Image Placeholder ]
           </div>
           <div className="aspect-[4/3] bg-mineral flex items-center justify-center p-8 text-center text-ink">
              [ Custom Wedding Decor Image Placeholder ]
           </div>
        </div>

        <div className="mt-16 flex justify-center">
           <Button asChild variant="primary" size="lg">
              <Link href="/contact">Inquire About Wedding Services</Link>
           </Button>
        </div>
      </div>
    </div>
  );
}
