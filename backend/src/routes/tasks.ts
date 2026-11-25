import { Router } from 'express';
import { taskController } from '../controllers/taskController';
import { taskDiscussionController } from '../controllers/taskDiscussionController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', taskController.getAll);
router.get('/stats', taskController.getStats);
router.get('/:id/comments', taskDiscussionController.getComments);
router.post('/:id/comments', taskDiscussionController.addComment);
router.put('/:id/comments/:commentId', taskDiscussionController.updateComment);
router.delete('/:id/comments/:commentId', taskDiscussionController.deleteComment);
router.get('/:id/history', taskDiscussionController.getHistory);
router.put('/:id', taskController.update);
router.delete('/:id', taskController.delete);

export default router;
