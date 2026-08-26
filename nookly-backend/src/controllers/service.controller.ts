import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../models/prisma";
import { HttpError } from "../utils/http-error";
import { getParam } from "../utils/params";
import { deleteFileByUrl, toPublicUrl } from "../utils/storage";
import type { ServiceItemInput } from "../validation/business.schemas";

async function addService(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = req.body as ServiceItemInput;
    const business = req.business!;

    // price is optional; omit the key when absent so Prisma stores NULL on
    // the nullable Decimal column (null/undefined aren't valid field values).
    const price = body.price == null ? undefined : body.price;

    const data: Prisma.ServiceItemCreateInput = {
      business: { connect: { id: business.id } },
      name: body.name,
      description: body.description ?? null,
    };
    if (price !== undefined) data.price = price;

    const serviceItem = await prisma.serviceItem.create({ data });

    res.status(201).json({ serviceItem });
  } catch (err) {
    next(err);
  }
}

async function updateService(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = req.body as Partial<ServiceItemInput>;

    const serviceItem = await prisma.serviceItem.findUnique({
      where: { id: getParam(req, "id") },
      include: { business: { select: { ownerId: true } } },
    });
    if (!serviceItem) {
      throw new HttpError(404, "Service item not found");
    }
    if (serviceItem.business.ownerId !== req.user!.id) {
      throw new HttpError(403, "You do not own this business");
    }

    // price is optional; omit it when absent so Prisma leaves the value
    // unchanged (null isn't a valid update value for the Decimal field here).
    const updateData: Prisma.ServiceItemUpdateInput = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description ?? null;
    if (body.price != null) updateData.price = body.price;

    const updated = await prisma.serviceItem.update({
      where: { id: serviceItem.id },
      data: updateData,
    });

    res.status(200).json({ serviceItem: updated });
  } catch (err) {
    next(err);
  }
}

async function deleteService(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const serviceItem = await prisma.serviceItem.findUnique({
      where: { id: getParam(req, "id") },
      include: { business: { select: { ownerId: true } } },
    });
    if (!serviceItem) {
      throw new HttpError(404, "Service item not found");
    }
    if (serviceItem.business.ownerId !== req.user!.id) {
      throw new HttpError(403, "You do not own this business");
    }

    // Clean up the service's photo file before the row is removed, so a
    // deleted service never leaves an orphaned upload on disk.
    if (serviceItem.imageUrl) {
      deleteFileByUrl(serviceItem.imageUrl);
    }
    await prisma.serviceItem.delete({ where: { id: serviceItem.id } });

    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

// POST /services/:id/photo — attach a public photo to a service/price item.
// Ownership is verified via the parent business (same pattern as the other
// service routes). Replaces any existing photo: the old file is deleted from
// disk before the new one is stored. The magic-byte validation middleware
// runs before this controller, so req.file contents are a real image.
async function uploadPhoto(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const file = req.file;
    if (!file) {
      throw new HttpError(400, "No image file provided");
    }

    const serviceItem = await prisma.serviceItem.findUnique({
      where: { id: getParam(req, "id") },
      include: { business: { select: { ownerId: true } } },
    });
    if (!serviceItem) {
      // Don't leave the just-written upload orphaned on disk.
      deleteFileByUrl(toPublicUrl(file.filename));
      throw new HttpError(404, "Service item not found");
    }
    if (serviceItem.business.ownerId !== req.user!.id) {
      deleteFileByUrl(toPublicUrl(file.filename));
      throw new HttpError(403, "You do not own this business");
    }

    const newUrl = toPublicUrl(file.filename);
    const updated = await prisma.serviceItem.update({
      where: { id: serviceItem.id },
      data: { imageUrl: newUrl },
    });

    // Replace semantics: the old image is deleted only AFTER the new one is
    // committed, so a DB failure never leaves the service with no photo.
    if (serviceItem.imageUrl) {
      deleteFileByUrl(serviceItem.imageUrl);
    }

    res.status(201).json({ serviceItem: updated });
  } catch (err) {
    next(err);
  }
}

// DELETE /services/:id/photo — remove the service photo (field -> null, file
// deleted from disk). Ownership verified via the parent business.
async function deletePhoto(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const serviceItem = await prisma.serviceItem.findUnique({
      where: { id: getParam(req, "id") },
      include: { business: { select: { ownerId: true } } },
    });
    if (!serviceItem) {
      throw new HttpError(404, "Service item not found");
    }
    if (serviceItem.business.ownerId !== req.user!.id) {
      throw new HttpError(403, "You do not own this business");
    }

    const oldUrl = serviceItem.imageUrl;
    await prisma.serviceItem.update({
      where: { id: serviceItem.id },
      data: { imageUrl: null },
    });

    if (oldUrl) {
      deleteFileByUrl(oldUrl);
    }

    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export const serviceController = { addService, updateService, deleteService, uploadPhoto, deletePhoto };
