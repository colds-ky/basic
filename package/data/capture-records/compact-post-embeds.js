// @ts-check

import { AppBskyEmbedRecordWithMedia, AppBskyEmbedVideo } from '@atproto/api';
import { getFeedBlobUrl, getFeedVideoBlobUrl } from '../../shorten';
import { addToArray } from '../compact-post';

/**
 * @param {string} shortDID
 * @param {import('../../firehose').RepositoryRecordTypes$['app.bsky.feed.post']['embed'] | undefined} embed
 */
export function extractEmbeds(shortDID, embed) {
  if (!embed) return;

  /** @type {import('../..').CompactEmbed[] | undefined} */
  let embeds = undefined;

  embeds = addEmbedImages(shortDID, /** @type {import('@atproto/api').AppBskyEmbedImages.Main} */(embed).images, embeds);
  embeds = addEmbedVideo(shortDID, /** @type {import('@atproto/api').AppBskyEmbedVideo.Main} */(embed), embeds);
  embeds = addEmbedExternal(shortDID, /** @type {import('@atproto/api').AppBskyEmbedExternal.Main} */(embed).external, embeds);
  embeds = addEmbedRecord(/** @type {import('@atproto/api').AppBskyEmbedRecord.Main} */(embed).record, embeds);
  embeds = addEmbedRecordMedia(shortDID, /** @type {import('@atproto/api').AppBskyEmbedRecordWithMedia.Main} */(embed), embeds);

  return embeds;
}

/**
 * @param {string} shortDID
 * @param {import('@atproto/api').AppBskyEmbedImages.Main['images'] | undefined} embedImages 
 * @param {import('../..').CompactEmbed[] | undefined} embeds 
 */
function addEmbedImages(shortDID, embedImages, embeds) {
  if (!embedImages?.length) return embeds;
  for (const img of embedImages) {
    if (!img) continue;
    embeds = addToArray(embeds, /** @type {import('../..').CompactEmbed} */({
      imgSrc: getFeedBlobUrl(shortDID, img.image?.ref?.toString()),
      description: img.alt || undefined,
      aspectRatio: img.aspectRatio
    }));
  }
  return embeds;
}

/**
 * @param {string} shortDID
 * @param {import('@atproto/api').AppBskyEmbedVideo.Main | undefined} embedVideo 
 * @param {import('../..').CompactEmbed[] | undefined} embeds 
 */
function addEmbedVideo(shortDID, embedVideo, embeds) {
  embeds = addToArray(embeds, /** @type {import('../..').CompactEmbed} */({
    imgSrc: getFeedVideoBlobUrl(shortDID, embedVideo?.video?.ref?.toString()),
    description: embedVideo?.alt || undefined,
    aspectRatio: embedVideo?.aspectRatio
  }));
  return embeds;
}

/**
 * @param {string} shortDID
 * @param {import('@atproto/api').AppBskyEmbedExternal.Main['external'] | undefined} embedExternal
 * @param {import('../..').CompactEmbed[] | undefined} embeds 
 */
function addEmbedExternal(shortDID, embedExternal, embeds) {
  if (!embedExternal?.uri) return embeds;
  return addToArray(embeds, /** @type {import('../..').CompactEmbed} */({
    url: embedExternal.uri || undefined,
    title: embedExternal.title || undefined,
    description: embedExternal.description || undefined,
    imgSrc: getFeedBlobUrl(shortDID, embedExternal.thumb?.ref?.toString())
  }));
}

/**
 * @param {import('@atproto/api').AppBskyEmbedRecord.Main['record'] | undefined} embedRecord
 * @param {import('../..').CompactEmbed[] | undefined} embeds 
 */
function addEmbedRecord(embedRecord, embeds) {
  if (!embedRecord?.uri) return embeds;
  return addToArray(embeds, /** @type {import('../..').CompactEmbed} */({
    url: embedRecord.uri
  }));
}

/**
 * @param {string} shortDID
 * @param {import('@atproto/api').AppBskyEmbedRecordWithMedia.Main | undefined} embedRecordMedia
 * @param {import('../..').CompactEmbed[] | undefined} embeds 
 */
function addEmbedRecordMedia(shortDID, embedRecordMedia, embeds) {
  embeds = addEmbedImages(
    shortDID,
    /** @type {import('@atproto/api').AppBskyEmbedImages.Main} */(embedRecordMedia?.media)?.images,
    embeds);

  embeds = addEmbedVideo(
    shortDID,
    /** @type {import('@atproto/api').AppBskyEmbedVideo.Main} */(embedRecordMedia?.media),
    embeds);

  embeds = addEmbedExternal(
    shortDID,
    /** @type {import('@atproto/api').AppBskyEmbedExternal.Main} */(embedRecordMedia?.media)?.external,
    embeds);

  embeds = addEmbedRecord(
    /** @type {import('@atproto/api').AppBskyEmbedRecord.Main} */(embedRecordMedia?.record)?.record,
    embeds);

  return embeds;
}
