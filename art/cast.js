import { personSheet, RAMPS as R } from "./person16.js";
export const CAST = [
  { name: "농부", skin: R.skin.fair, hair: R.hair.brown, hairStyle: "short", shirt: R.cloth.cream, pants: R.cloth.blue, over: "overalls", hat: "straw" },
  { name: "대장장이", skin: R.skin.tan, hair: R.hair.black, hairStyle: "short", top: "tunic", shirt: R.cloth.red, pants: R.cloth.gray, over: "apron", apron: R.cloth.brown, prop: "hammer" },
  { name: "엘프", skin: R.skin.pale, hair: R.hair.blond, hairStyle: "long", top: "tunic", shirt: R.cloth.green, pants: R.cloth.cream, over: "vest", vest: R.cloth.brown, ears: "long", eye: "#4c7050", hat: "crown", prop: "book" },
  { name: "수인", skin: R.skin.tan, hair: R.hair.red, hairStyle: "short", shirt: R.cloth.cream, pants: R.cloth.green, over: "vest", vest: R.cloth.red, ears: "animal", tail: true, hat: "beanie" },
  { name: "드워프", skin: R.skin.fair, hair: R.hair.red, hairStyle: "short", top: "tunic", shirt: R.cloth.purple, pants: R.cloth.brown, beard: true, hat: "hood" },
  { name: "용족", skin: R.skin.scale, hair: R.hair.white, hairStyle: "bun", top: "robe", shirt: R.cloth.purple, pants: R.cloth.gray, horns: true, tail: true, eye: "#a24a2e", hat: "wizard", prop: "staff" },
  { name: "제빵사", skin: R.skin.deep, hair: R.hair.black, hairStyle: "bun", shirt: R.cloth.blue, pants: R.cloth.brown, bottom: "skirt", over: "apron", apron: R.cloth.cream, hat: "chef", prop: "basket" },
  { name: "기사", skin: R.skin.fair, hair: R.hair.blond, hairStyle: "long", top: "tunic", shirt: R.cloth.gray, pants: R.cloth.gray, over: "vest", vest: R.cloth.blue, hat: "helmet", prop: "sword" },
  { name: "소녀", skin: R.skin.fair, hair: R.hair.brown, hairStyle: "long", shirt: R.cloth.red, pants: R.cloth.cream, bottom: "skirt", hat: "ribbon" },
];
export const SHEETS = CAST.map((c) => personSheet(c));
