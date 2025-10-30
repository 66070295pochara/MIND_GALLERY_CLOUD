// tests/gallery.test.js (ESM)
import { jest } from '@jest/globals';

// ---- Mock modules BEFORE importing the SUT ----
const fsMock = {
  existsSync: jest.fn(),
  unlinkSync: jest.fn(),
};

// mock fs (สไตล์ default import)
jest.unstable_mockModule('fs', () => ({
    __esModule: true,
    default: fsMock,
}));

// เตรียมอ็อบเจกต์ไว้ให้แก้ไขเมธอดภายหลังในเทส
const ImageMockObj = {};
const UserMockObj  = {};

// mock Mongoose models (default export)
jest.unstable_mockModule('../models/Image.js', () => ({
    __esModule: true,
    default: ImageMockObj,
}));
jest.unstable_mockModule('../models/User.js', () => ({
    __esModule: true,
    default: UserMockObj,
}));

// ตอนนี้ค่อย import ของจริง (จะได้ของที่ถูก mock แล้ว)
const { default: fs } = await import('fs');
const { default: Image } = await import('../models/Image.js');
const { default: User } = await import('../models/User.js');
const { default: galleryController } = await import('../controllers/galleryController.js');

// ---------- ด้านล่างคงเทสเดิมของคุณได้เลย ----------
// (helper, mockRes, mockReq, asMongooseArray, chainFindSortLean, makeImageDoc, tests ...)
// ตัวอย่าง: ให้แน่ใจว่าในโค้ดทดสอบเรียกใช้ Image / User ที่ import มาจากด้านบน


// helper: สร้าง res แบบ Express
const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  res.send   = jest.fn().mockReturnValue(res);
  res.sendFile = jest.fn().mockReturnValue(res);
  res.set    = jest.fn().mockReturnValue(res);
  return res;
};

const mockUser = (overrides = {}) => ({
  id: 'u1',
  name: 'Alice',
  ...overrides
});

const mockReq = (overrides = {}) => ({
  params: {},
  body: {},
  query: {},
  user: mockUser(),
  file: undefined,
  ...overrides
});

// ช่วยทำให้ array มี method แบบ Mongoose Array
const asMongooseArray = (arr = []) => {
  arr.addToSet = (v) => {
    if (!arr.includes(v)) arr.push(v);
  };
  arr.pull = (v) => {
    const i = arr.indexOf(v);
    if (i >= 0) arr.splice(i, 1);
  };
  return arr;
};

// สร้าง chain find().sort().lean()
const chainFindSortLean = (leanValue) => ({
  sort: jest.fn(() => ({
    lean: jest.fn().mockResolvedValue(leanValue)
  }))
});

// สร้าง Document Image mock
const makeImageDoc = (overrides = {}) => {
  const doc = {
    _id: 'img1',
    userId: 'u1',
    authorName: 'Alice',
    originalName: 'photo.jpg',
    storedName: 'stored.jpg',
    mime: 'image/jpeg',
    size: 123,
    path: '/tmp/stored.jpg',
    isPublic: false,
    likes: asMongooseArray([]),
    save: jest.fn().mockResolvedValue(),
    deleteOne: jest.fn().mockResolvedValue(),
    toObject: function () {
      // จำลอง .toObject() คืนค่า fields ปกติ
      const { save, deleteOne, toObject, ...rest } = this;
      return { ...rest };
    },
    ...overrides
  };
  // เผื่อถูก override likes เป็น array ธรรมดา
  if (!doc.likes.addToSet) doc.likes = asMongooseArray(doc.likes);
  return doc;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('galleryController.uploadImage', () => {
  test('400 เมื่อไม่มีไฟล์', async () => {
    const req = mockReq();
    const res = mockRes();
    await galleryController.uploadImage(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'No file' });
  });

  test('200 และคืน imageId เมื่ออัปโหลดสำเร็จ', async () => {
    const req = mockReq({
      file: {
        originalname: 'a.jpg',
        filename: 'abc123.jpg',
        mimetype: 'image/jpeg',
        size: 999,
        path: '/tmp/abc123.jpg'
      },
      body: { isPublic: 'true', description: 'desc' }
    });
    const res = mockRes();

    const created = makeImageDoc({ _id: 'newImgId' });
    Image.create = jest.fn().mockResolvedValue(created);

    await galleryController.uploadImage(req, res);

    expect(Image.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'u1',
      authorName: 'Alice',
      originalName: 'a.jpg',
      storedName: 'abc123.jpg',
      isPublic: true,
      description: 'desc'
    }));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ ok: true, imageId: 'newImgId' });
  });
});

describe('galleryController.getMyGallery', () => {
  test('คืน items ที่ map url และ likes', async () => {
    const req = mockReq();
    const res = mockRes();

    const rows = [
      { _id: 'i1', userId: 'u1', storedName: 's1.png', createdAt: new Date(), likes: ['x'] },
      { _id: 'i2', userId: 'u1', storedName: 's2.png', createdAt: new Date() } // ไม่มี likes/url
    ];
    Image.find = jest.fn(() => chainFindSortLean(rows));

    await galleryController.getMyGallery(req, res);

    expect(Image.find).toHaveBeenCalledWith({ userId: 'u1' });
    expect(res.set).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.items).toHaveLength(2);
    expect(payload.items[0].url).toBe(`/uploads/u1/s1.png`);
    expect(payload.items[0].likes).toEqual(['x']);
    expect(payload.items[1].url).toBe(`/uploads/u1/s2.png`);
    expect(payload.items[1].likes).toEqual([]);
  });
});

describe('galleryController.getPublicGallery', () => {
  test('คืน public items พร้อม url ที่ encode ชื่อไฟล์', async () => {
    const res = mockRes();
    const req = mockReq();

    const docs = [
      makeImageDoc({ _id: 'p1', isPublic: true, storedName: 'hello world.png' }),
      makeImageDoc({ _id: 'p2', isPublic: true, storedName: 'ไทย.png', userId: 'u9' })
    ];

    Image.find = jest.fn(() => ({
      sort: jest.fn().mockResolvedValue(docs)
    }));

    await galleryController.getPublicGallery(req, res);

    expect(Image.find).toHaveBeenCalledWith({ isPublic: true });
    expect(res.status).toHaveBeenCalledWith(200);
    const { items } = res.json.mock.calls[0][0];
    expect(items[0].url).toBe(`/uploads/u1/${encodeURIComponent('hello world.png')}`);
    expect(items[1].url).toBe(`/uploads/u9/${encodeURIComponent('ไทย.png')}`);
  });
});

describe('galleryController.updateDescription', () => {
  test('404 เมื่อไม่พบภาพหรือไม่ใช่เจ้าของ', async () => {
    const req = mockReq({ params: { imageId: 'imgX' }, body: { description: '  hi  ' } });
    const res = mockRes();
    Image.findOneAndUpdate = jest.fn(() => ({ select: jest.fn().mockResolvedValue(null) }));

    await galleryController.updateDescription(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('200 เมื่ออัปเดตสำเร็จ', async () => {
    const req = mockReq({ params: { imageId: 'img1' }, body: { description: '  new desc  ' } });
    const res = mockRes();
    const updated = { _id: 'img1', originalName: 'a.jpg', description: 'new desc', userId: 'u1', createdAt: new Date() };

    Image.findOneAndUpdate = jest.fn(() => ({
      select: jest.fn().mockResolvedValue(updated)
    }));

    await galleryController.updateDescription(req, res);

    expect(Image.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'img1', userId: 'u1' },
      { description: 'new desc' },
      { new: true }
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      ok: true,
      image: updated
    }));
  });
});

describe('galleryController.togglePublic', () => {
  test('404 ถ้าไม่พบรูป', async () => {
    const req = mockReq({ params: { id: 'img404' } });
    const res = mockRes();
    Image.findById = jest.fn().mockResolvedValue(null);

    await galleryController.togglePublic(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('403 ถ้าไม่ใช่เจ้าของ', async () => {
    const req = mockReq({ params: { id: 'img1' }, user: mockUser({ id: 'uA' }) });
    const res = mockRes();
    const doc = makeImageDoc({ userId: 'uB' });
    Image.findById = jest.fn().mockResolvedValue(doc);

    await galleryController.togglePublic(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('สลับ public และบันทึก', async () => {
    const req = mockReq({ params: { id: 'img1' } });
    const res = mockRes();
    const doc = makeImageDoc({ isPublic: false, userId: 'u1' });
    Image.findById = jest.fn().mockResolvedValue(doc);

    await galleryController.togglePublic(req, res);
    expect(doc.isPublic).toBe(true);
    expect(doc.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ ok: true, newStatus: true });
  });
});

describe('galleryController.deleteImage', () => {
  // note: controller ใช้ mongoose.Types.ObjectId.isValid ภายในไฟล์ controller
  // เราไม่ mock mongoose ตรง ๆ ที่นี่ เพียงทดสอบ Flow หลัก
  test('400 เมื่อ id ไม่ถูกต้อง', async () => {
    // จำลอง invalid โดยชี้ไปที่ฟังก์ชันจริงไม่ได้ เราเลี่ยงด้วยการจำลองกรณีนี้ผ่านการ set ฟังก์ชันบน global mongoose
    const req = mockReq({ params: { imageId: 'bad' } });
    const res = mockRes();

    // แทรก shim ชั่วคราว: ทำให้ isValid = () => false
    const mongoose = (await import('mongoose')).default;
    const spy = jest.spyOn(mongoose.Types.ObjectId, 'isValid').mockReturnValue(false);

    await galleryController.deleteImage(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    spy.mockRestore();
  });

  test('404 เมื่อไม่พบรูป', async () => {
    const req = mockReq({ params: { imageId: 'img404' } });
    const res = mockRes();

    const mongoose = (await import('mongoose')).default;
    jest.spyOn(mongoose.Types.ObjectId, 'isValid').mockReturnValue(true);

    Image.findById = jest.fn().mockResolvedValue(null);

    await galleryController.deleteImage(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('403 เมื่อไม่ใช่เจ้าของ', async () => {
    const req = mockReq({ params: { imageId: 'img1' }, user: mockUser({ id: 'uA' }) });
    const res = mockRes();

    const mongoose = (await import('mongoose')).default;
    jest.spyOn(mongoose.Types.ObjectId, 'isValid').mockReturnValue(true);

    const doc = makeImageDoc({ userId: 'uB' });
    Image.findById = jest.fn().mockResolvedValue(doc);

    await galleryController.deleteImage(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('ลบไฟล์บนดิสก์ถ้ามี และลบเอกสารสำเร็จ', async () => {
    const req = mockReq({ params: { imageId: 'img1' } });
    const res = mockRes();

    const mongoose = (await import('mongoose')).default;
    jest.spyOn(mongoose.Types.ObjectId, 'isValid').mockReturnValue(true);

    const doc = makeImageDoc({ path: '/tmp/x.png', userId: 'u1' });
    Image.findById = jest.fn().mockResolvedValue(doc);

    fs.existsSync.mockReturnValue(true);

    await galleryController.deleteImage(req, res);

    expect(fs.existsSync).toHaveBeenCalledWith('/tmp/x.png');
    expect(fs.unlinkSync).toHaveBeenCalledWith('/tmp/x.png');
    expect(doc.deleteOne).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      ok: true,
      imageId: 'img1'
    }));
  });
});

describe('galleryController.toggleLike', () => {
  test('404 เมื่อไม่เจอผู้ใช้', async () => {
    const req = mockReq({ params: { imageId: 'img1' } });
    const res = mockRes();
    User.findById = jest.fn().mockResolvedValue(null);

    await galleryController.toggleLike(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('404 เมื่อไม่เจอรูป', async () => {
    const req = mockReq({ params: { imageId: 'imgX' } });
    const res = mockRes();
    User.findById = jest.fn().mockResolvedValue({ _id: 'u1', likedImages: asMongooseArray([]), save: jest.fn() });
    Image.findById = jest.fn().mockResolvedValue(null);

    await galleryController.toggleLike(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('กดไลก์: เพิ่ม userId ใน image.likes และ imageId ใน user.likedImages', async () => {
    const req = mockReq({ params: { imageId: 'img1' }, user: mockUser({ id: 'u1' }) });
    const res = mockRes();

    const userDoc = { _id: 'u1', likedImages: asMongooseArray([]), save: jest.fn().mockResolvedValue() };
    const imgDoc = makeImageDoc({ _id: 'img1', likes: asMongooseArray([]) });

    User.findById = jest.fn().mockResolvedValue(userDoc);
    Image.findById = jest.fn().mockResolvedValue(imgDoc);

    await galleryController.toggleLike(req, res);

    expect(imgDoc.likes).toContain('u1');
    expect(userDoc.likedImages).toContain('img1');
    expect(imgDoc.save).toHaveBeenCalled();
    expect(userDoc.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    const resp = res.json.mock.calls[0][0];
    expect(resp.ok).toBe(true);
    expect(resp.liked).toBe(true);
    expect(resp.countLikes).toBe(1);
  });

  test('ยกเลิกไลก์: เอา userId ออกจาก image.likes และ imageId ออกจาก user.likedImages', async () => {
    const req = mockReq({ params: { imageId: 'img1' }, user: mockUser({ id: 'u1' }) });
    const res = mockRes();

    const userDoc = { _id: 'u1', likedImages: asMongooseArray(['img1']), save: jest.fn().mockResolvedValue() };
    const imgDoc = makeImageDoc({ _id: 'img1', likes: asMongooseArray(['u1']) });

    User.findById = jest.fn().mockResolvedValue(userDoc);
    Image.findById = jest.fn().mockResolvedValue(imgDoc);

    await galleryController.toggleLike(req, res);

    expect(imgDoc.likes).not.toContain('u1');
    expect(userDoc.likedImages).not.toContain('img1');
    expect(res.status).toHaveBeenCalledWith(200);
    const resp = res.json.mock.calls[0][0];
    expect(resp.liked).toBe(false);
    expect(resp.countLikes).toBe(0);
  });
});

describe('galleryController.getLikeUser', () => {
  test('404 เมื่อไม่เจอรูป', async () => {
    const req = mockReq({ params: { imageId: 'img404' } });
    const res = mockRes();

    // จำลอง chain: findById().populate().sort() -> resolves เป็น null
    Image.findById = jest.fn(() => ({
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockResolvedValue(null)
    }));

    await galleryController.getLikeUser(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('200 และคืน likedUsers + countLikes', async () => {
    const req = mockReq({ params: { imageId: 'img1' } });
    const res = mockRes();

    const imgDoc = makeImageDoc({
      likes: [{ _id: 'u1', name: 'Alice', email: 'a@a.com' }, { _id: 'u2', name: 'Bob', email: 'b@b.com' }]
    });

    Image.findById = jest.fn(() => ({
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockResolvedValue(imgDoc)
    }));

    await galleryController.getLikeUser(req, res);

    expect(Image.findById).toHaveBeenCalledWith('img1');
    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.countLikes).toBe(2);
    expect(payload.likedUsers.map(u => u.name)).toEqual(['Alice', 'Bob']);
  });
});