import { describe, it, expect } from 'vitest';
import { pickImageUrl, backgroundImageUrl } from './overlay-image';

describe('pickImageUrl', () => {
  it('returns the src of the first <img> in the stack', () => {
    const div = document.createElement('div');
    const img = document.createElement('img');
    img.src = 'https://cdn.example.com/photo.jpg';
    expect(pickImageUrl([div, img])).toBe('https://cdn.example.com/photo.jpg');
  });

  it('falls back to a CSS background-image url when no <img> is present', () => {
    const div = document.createElement('div');
    div.style.backgroundImage = 'url("https://cdn.example.com/bg.png")';
    expect(pickImageUrl([div])).toBe('https://cdn.example.com/bg.png');
  });

  it('prefers an <img> over a background-image', () => {
    const div = document.createElement('div');
    div.style.backgroundImage = 'url("https://cdn.example.com/bg.png")';
    const img = document.createElement('img');
    img.src = 'https://cdn.example.com/photo.jpg';
    expect(pickImageUrl([div, img])).toBe('https://cdn.example.com/photo.jpg');
  });

  it('returns null when there is no image', () => {
    expect(pickImageUrl([document.createElement('div'), document.createElement('p')])).toBeNull();
  });
});

describe('backgroundImageUrl', () => {
  it('extracts the url from a background-image', () => {
    const div = document.createElement('div');
    div.style.backgroundImage = 'url("https://cdn.example.com/x.png")';
    expect(backgroundImageUrl(div)).toBe('https://cdn.example.com/x.png');
  });

  it('returns null when there is no background image', () => {
    expect(backgroundImageUrl(document.createElement('div'))).toBeNull();
  });
});
