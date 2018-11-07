import Block from './block.model';
import DefaultFollow from './defaultFollow.model';
import Follow from './follow.model';
// import Like from './like.model';
import Notification from './notification.model';
import Order from './order.model';
import Product from './product.model';
import Report from './report.model';
import Review from './review.model';
import Tag from './tag.model';
import User from './user.model';
import Verification from './verification.model';

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
  DefaultFollow,
  Follow,
  // Like,
  Notification,
  Order,
  Product,
  Report,
  Review,
  Tag,
  User,
  Verification,
};
