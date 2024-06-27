// @ts-check

import { addToArray } from '../compact-post';

/**
 * @param {import('../../firehose').RepoRecord$Typed['app.bsky.feed.post']['embed'] | undefined} embed
 */
export function extractEmbeds(embed) {
  if (!embed) return;

  /** @type {import('../..').CompactEmbed[] | undefined} */
  let embeds = undefined;

  embeds = addEmbedImages(/** @type {import('@atproto/api').AppBskyEmbedImages.Main} */(embed).images, embeds);
  embeds = addEmbedExternal(/** @type {import('@atproto/api').AppBskyEmbedExternal.Main} */(embed).external, embeds);
  embeds = addEmbedRecord(/** @type {import('@atproto/api').AppBskyEmbedRecord.Main} */(embed).record, embeds);
  embeds = addEmbedRecordMedia(/** @type {import('@atproto/api').AppBskyEmbedRecordWithMedia.Main} */(embed).media, embeds);

  return embeds;
}

/**
 * @param {import('@atproto/api').AppBskyEmbedImages.Main['images'] | undefined} embedImages 
 * @param {import('../..').CompactEmbed[] | undefined} embeds 
 */
function addEmbedImages(embedImages, embeds) {
  if (!embedImages?.length) return embeds;
  for (const img of embedImages) {
    if (!img) continue;
    embeds = addToArray(embeds, /** @type {import('../..').CompactEmbed} */({
      imgSrc: img.image?.toString(),
      description: img.alt,
      aspectRatio: img.aspectRatio
    }));
  }
  return embeds;
}

/**
 * @param {import('@atproto/api').AppBskyEmbedExternal.Main['external'] | undefined} embedExternal
 * @param {import('../..').CompactEmbed[] | undefined} embeds 
 */
function addEmbedExternal(embedExternal, embeds) {
  if (!embedExternal) return embeds;
  return addToArray(embeds, /** @type {import('../..').CompactEmbed} */({
    url: embedExternal.url,
    title: embedExternal.title,
    description: embedExternal.description,
    imgSrc: embedExternal.thumb?.toString()
  }));
}

/**
 * @param {import('@atproto/api').AppBskyEmbedRecord.Main['record'] | undefined} embedRecord
 * @param {import('../..').CompactEmbed[] | undefined} embeds 
 */
function addEmbedRecord(embedRecord, embeds) {
  if (!embedRecord) return embeds;
  return addToArray(embeds, /** @type {import('../..').CompactEmbed} */({
    url: embedRecord.uri
  }));
}

/**
 * @param {import('@atproto/api').AppBskyEmbedRecordWithMedia.Main['media'] | undefined} embedRecordMedia
 * @param {import('../..').CompactEmbed[] | undefined} embeds 
 */
function addEmbedRecordMedia(embedRecordMedia, embeds) {
  if (!embedRecordMedia) return embeds;
  embeds = addEmbedImages(/** @type {import('@atproto/api').AppBskyEmbedImages.Main} */(embedRecordMedia).images, embeds);
  embeds = addEmbedExternal(/** @type {import('@atproto/api').AppBskyEmbedExternal.Main} */(embedRecordMedia).external, embeds);
  return embeds;
}
