#  Mind Gallery Cloud

Mind Gallery Cloud คือแพลตฟอร์มเว็บแอปพลิเคชันสำหรับจัดเก็บและเผยแพร่ผลงานรูปภาพ โดยโปรเจคนี้เป็นการนำระบบ 

### **Mind Gallery เดิมมาต่อยอดและยกระดับ** 

ขึ้นสู่ระบบ Cloud Computing อย่างเต็มรูปแบบบนโครงข่ายของ AWS  เพื่อรองรับการจัดการไฟล์ภาพและข้อมูลที่มีประสิทธิภาพมากขึ้น
(./preview_image/cloud.png)

# Mind Gallery Preview
### วิดีโอสาธิตการใช้งาน (YouTube Demo)
https://www.youtube.com/watch?v=umptcgdLv9w&feature=youtu.be



## 🌟 จุดเด่นของการต่อยอดโปรเจคนี้
- **Cloud-Native Storage:** เปลี่ยนการเก็บไฟล์รูปภาพจากเซิร์ฟเวอร์แบบเดิมไปใช้ **Amazon S3** เพื่อความปลอดภัยและขยายพื้นที่จัดเก็บได้ไม่จำกัด
- **NoSQL Cloud Database:** ย้ายระบบฐานข้อมูลมาใช้ **Amazon DynamoDB** ที่อยู่บน Private Subnet เพื่อความปลอดภัยของข้อมูลผู้ใช้งาน
- **Automated Deployment:** ใช้ **AWS Elastic Beanstalk** ร่วมกับ **Amazon EC2** ในการจัดการและ Deploy เซิร์ฟเวอร์
- **Security & Network:** มีการวางระบบ VPC, แบ่ง Public/Private Subnet และตั้งค่าสิทธิ์ผ่าน IAM

## ✨ Features
- **Authentication:** ระบบสมัครสมาชิก (Register) และเข้าสู่ระบบ (Login) เพื่อยืนยันตัวตนผู้ใช้งาน
- **Cloud Storage & Management:** ระบบอัปโหลด ลบ และแก้ไขคำอธิบายรูปภาพ (Description) โดยไฟล์ภาพทั้งหมดจะถูกจัดเก็บอย่างปลอดภัยบน **Amazon S3**
- **Privacy & Visibility:** ผู้ใช้งานสามารถกำหนดและปรับเปลี่ยนสถานะของรูปภาพแต่ละภาพให้เป็น Public (สาธารณะ) หรือ Private (ส่วนตัว) ได้
- **Interactions:** ระบบกดถูกใจ (Like) และแสดงความคิดเห็น (Comment) ต่อผลงานรูปภาพ 
- **Gallery Views:** การแสดงผลแกลเลอรีแบ่งออกเป็น 3 หน้าหลัก ได้แก่ Own Gallery (ผลงานส่วนตัว), All Gallery (ผลงานสาธารณะทั้งหมด) และ Favorite Gallery (รูปภาพที่เคยกดถูกใจไว้)
- **SSR (Server-Side Rendering):** แสดงผลหน้าเว็บอย่างรวดเร็วด้วย EJS Template Engine

## 🧰 Tech Stack

**Frontend & Server (Application Layer)**
- Node.js & Express.js 
- Template Engine: EJS 
- Styling: CSS 

**Cloud Infrastructure (AWS Services)**
- AWS Elastic Beanstalk & Amazon EC2 (Compute) 
- Amazon S3 (Object Storage) 
- Amazon DynamoDB (NoSQL Database) 
- AWS VPC, IAM, CloudWatch (Network, Security & Monitoring) 



## 📡 API Testing (Postman)

โปรเจคนี้ได้จัดเตรียม API Documentation และ Collection ไว้สำหรับการทดสอบเรียบร้อยแล้ว โดยครอบคลุมระบบการทำงานหลักทั้งหมด (User, Gallery, Comment และ Like) s

![Postman](./preview_image/postman.png)

### Postman Documentation 

สามารถดูรายละเอียดของ Endpoint ต่างๆ รวมถึงรูปแบบ Request และตัวอย่าง Response 

 **[Mind Gallery Cloud API Documentation](https://documenter.getpostman.com/view/47036038/2sBXionA9N)**



### Import ไฟล์ Collection สำหรับทดสอบในเครื่อง
หากต้องการทดสอบยิง API ด้วยตัวเองผ่าน Localhost สามารถทำตามขั้นตอนต่อไปนี้:
[Mind Gallery API.postman_collection.json](./postman/Mind%20Gallery%20API.postman_collection.json)
```bash
1. ไปที่โฟลเดอร์ `postman/` ภายในโปรเจคนี้
```
```bash
2. นำไฟล์ `Mind Gallery API.postman_collection.json` ไป Import ลงในโปรแกรม Postman ของคุณ
```
```bash
3. เริ่มต้นทดสอบ API ต่างๆ ในระบบได้ทันที
```
