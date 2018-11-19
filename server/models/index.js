import Block, { BlockDoc } from './block.model';
import DefaultFollow, { DefaultFollowDoc } from './defaultFollow.model';
import Cities from './cities.model';
import Deparments from './departments.model';
import Follow, { FollowDoc } from './follow.model';
// import Like from './like.model';
import Notification, { NotificationDoc } from './notification.model';
import Order, { OrderDoc } from './order.model';
import Product, { ProductDoc, CommentDoc } from './product.model';
import Report, { ReportDoc } from './report.model';
import Review, { ReviewDoc } from './review.model';
import Tag, { TagDoc } from './tag.model';
import User, { UserDoc } from './user.model';
import Verification, { VerificationDoc } from './verification.model';

Block.syncIndexes();
DefaultFollow.syncIndexes();
Follow.syncIndexes();
Notification.syncIndexes();
Product.syncIndexes();
Report.syncIndexes();
Review.syncIndexes();
Tag.syncIndexes();
User.syncIndexes();
Verification.syncIndexes();

export {
  Block,
  BlockDoc,
  Cities,
  CommentDoc,
  Deparments,
  DefaultFollow,
  DefaultFollowDoc,
  Follow,
  FollowDoc,
  // Like,
  Notification,
  NotificationDoc,
  Order,
  OrderDoc,
  Product,
  ProductDoc,
  Report,
  ReportDoc,
  Review,
  ReviewDoc,
  Tag,
  TagDoc,
  User,
  UserDoc,
  Verification,
  VerificationDoc,
};
