-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'EDITOR');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "FieldType" AS ENUM ('SELECT', 'TEXT', 'SWATCH', 'SIZE', 'NUMBER', 'FILE');

-- CreateEnum
CREATE TYPE "InquirySource" AS ENUM ('PRODUCT', 'CUSTOM_ORDER', 'CONTACT');

-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('NEW', 'CONTACTED', 'CONFIRMED', 'DELIVERED');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO', 'DOCUMENT', 'MODEL3D');

-- CreateEnum
CREATE TYPE "ScrapeTier" AS ENUM ('OWNER', 'RESIN_GOODS', 'SUPPLIES', 'PRINT3D');

-- CreateEnum
CREATE TYPE "ScrapePlatform" AS ENUM ('SHOPIFY', 'WOOCOMMERCE', 'JSONLD', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ScrapeJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'IMPORTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "hashedPassword" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'EDITOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "image" TEXT,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "shortTagline" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "priceMin" INTEGER,
    "priceMax" INTEGER,
    "showPrice" BOOLEAN NOT NULL DEFAULT true,
    "timeline" TEXT,
    "materials" TEXT,
    "dimensions" TEXT,
    "occasions" JSONB NOT NULL DEFAULT '[]',
    "careNotes" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "videoUrl" TEXT,
    "model3dUrl" TEXT,
    "categoryId" TEXT NOT NULL,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "ogImage" TEXT,
    "needsRewrite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL DEFAULT 0,
    "productId" TEXT NOT NULL,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomizationField" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "FieldType" NOT NULL,
    "options" JSONB NOT NULL DEFAULT '[]',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "helpText" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CustomizationField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inquiry" (
    "id" TEXT NOT NULL,
    "source" "InquirySource" NOT NULL,
    "productId" TEXT,
    "customerName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "selections" JSONB NOT NULL DEFAULT '{}',
    "referenceImageUrls" JSONB NOT NULL DEFAULT '[]',
    "budgetRange" TEXT,
    "timeline" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "whatsappMessage" TEXT NOT NULL,
    "status" "InquiryStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Inquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Portfolio" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "story" TEXT NOT NULL DEFAULT '',
    "beforeImageUrl" TEXT,
    "afterImageUrl" TEXT,
    "videoUrl" TEXT,
    "resultsMeta" JSONB NOT NULL DEFAULT '{}',
    "categoryId" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Portfolio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioImage" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL DEFAULT 0,
    "portfolioId" TEXT NOT NULL,

    CONSTRAINT "PortfolioImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlogCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "BlogCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlogPost" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL DEFAULT '',
    "content" JSONB NOT NULL DEFAULT '{}',
    "coverImage" TEXT,
    "authorName" TEXT NOT NULL DEFAULT 'ResinRiva Studio',
    "blogCategoryId" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlogPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Testimonial" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "quote" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 5,
    "avatarUrl" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Testimonial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Faq" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Faq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "pathname" TEXT NOT NULL,
    "type" "MediaType" NOT NULL DEFAULT 'IMAGE',
    "folder" TEXT NOT NULL DEFAULT '',
    "bytes" INTEGER NOT NULL DEFAULT 0,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Page" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL DEFAULT '{}',
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteSettings" (
    "id" TEXT NOT NULL DEFAULT 'main',
    "brandName" TEXT NOT NULL DEFAULT 'ResinRiva',
    "tagline" TEXT NOT NULL DEFAULT '',
    "logoUrl" TEXT,
    "heroVideoUrl" TEXT,
    "announcement" TEXT,
    "phone" TEXT NOT NULL DEFAULT '',
    "whatsappNumber" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "mapsUrl" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "socials" JSONB NOT NULL DEFAULT '{}',
    "defaultSeo" JSONB NOT NULL DEFAULT '{}',
    "defaultCareNotes" TEXT,

    CONSTRAINT "SiteSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapeSource" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "tier" "ScrapeTier" NOT NULL,
    "vertical" TEXT NOT NULL DEFAULT 'resin',
    "country" TEXT NOT NULL DEFAULT 'IN',
    "platform" "ScrapePlatform" NOT NULL DEFAULT 'UNKNOWN',
    "supply" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "verifiedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "ScrapeSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapeJob" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT,
    "inputUrl" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "platform" "ScrapePlatform" NOT NULL,
    "vertical" TEXT NOT NULL DEFAULT 'resin',
    "status" "ScrapeJobStatus" NOT NULL DEFAULT 'QUEUED',
    "cursorPage" INTEGER NOT NULL DEFAULT 0,
    "totalScraped" INTEGER NOT NULL DEFAULT 0,
    "newCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "sheetSynced" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ScrapeJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapedProduct" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "vertical" TEXT NOT NULL DEFAULT 'resin',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT,
    "shortTagline" TEXT,
    "description" TEXT,
    "priceMin" INTEGER,
    "priceMax" INTEGER,
    "showPrice" BOOLEAN,
    "timeline" TEXT,
    "materials" TEXT,
    "dimensions" TEXT,
    "status" TEXT,
    "featured" BOOLEAN,
    "images" JSONB NOT NULL DEFAULT '[]',
    "imageAlts" JSONB NOT NULL DEFAULT '[]',
    "fields" JSONB NOT NULL DEFAULT '{}',
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "contentHash" TEXT NOT NULL,
    "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "importedProductId" TEXT,

    CONSTRAINT "ScrapedProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_BlogPostToTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_BlogPostToTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE INDEX "Product_categoryId_status_idx" ON "Product"("categoryId", "status");

-- CreateIndex
CREATE INDEX "Product_status_featured_idx" ON "Product"("status", "featured");

-- CreateIndex
CREATE INDEX "ProductImage_productId_idx" ON "ProductImage"("productId");

-- CreateIndex
CREATE INDEX "CustomizationField_productId_idx" ON "CustomizationField"("productId");

-- CreateIndex
CREATE INDEX "Inquiry_status_createdAt_idx" ON "Inquiry"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Portfolio_slug_key" ON "Portfolio"("slug");

-- CreateIndex
CREATE INDEX "PortfolioImage_portfolioId_idx" ON "PortfolioImage"("portfolioId");

-- CreateIndex
CREATE UNIQUE INDEX "BlogCategory_slug_key" ON "BlogCategory"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "BlogPost_slug_key" ON "BlogPost"("slug");

-- CreateIndex
CREATE INDEX "BlogPost_status_publishedAt_idx" ON "BlogPost"("status", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Media_pathname_key" ON "Media"("pathname");

-- CreateIndex
CREATE INDEX "Media_folder_idx" ON "Media"("folder");

-- CreateIndex
CREATE UNIQUE INDEX "Page_slug_key" ON "Page"("slug");

-- CreateIndex
CREATE INDEX "ActivityLog_entity_createdAt_idx" ON "ActivityLog"("entity", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ScrapeSource_key_key" ON "ScrapeSource"("key");

-- CreateIndex
CREATE INDEX "ScrapeSource_tier_enabled_idx" ON "ScrapeSource"("tier", "enabled");

-- CreateIndex
CREATE INDEX "ScrapeJob_status_createdAt_idx" ON "ScrapeJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ScrapedProduct_reviewStatus_idx" ON "ScrapedProduct"("reviewStatus");

-- CreateIndex
CREATE INDEX "ScrapedProduct_jobId_idx" ON "ScrapedProduct"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "ScrapedProduct_sourceKey_externalId_key" ON "ScrapedProduct"("sourceKey", "externalId");

-- CreateIndex
CREATE INDEX "_BlogPostToTag_B_index" ON "_BlogPostToTag"("B");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomizationField" ADD CONSTRAINT "CustomizationField_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Portfolio" ADD CONSTRAINT "Portfolio_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioImage" ADD CONSTRAINT "PortfolioImage_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogPost" ADD CONSTRAINT "BlogPost_blogCategoryId_fkey" FOREIGN KEY ("blogCategoryId") REFERENCES "BlogCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrapeJob" ADD CONSTRAINT "ScrapeJob_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ScrapeSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrapedProduct" ADD CONSTRAINT "ScrapedProduct_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ScrapeJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BlogPostToTag" ADD CONSTRAINT "_BlogPostToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "BlogPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BlogPostToTag" ADD CONSTRAINT "_BlogPostToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
