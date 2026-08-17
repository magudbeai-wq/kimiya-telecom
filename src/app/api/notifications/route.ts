import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/utils/auth-middleware';
import { NotificationService } from '@/lib/services/notifications';

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  const result = NotificationService.getUserNotifications({
    id: authResult.user.id,
    role: authResult.user.role,
    branch_id: authResult.user.branch_id,
  });

  return NextResponse.json({ success: true, ...result });
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await req.json();
    const { action, notificationId } = body;

    if (action === 'MARK_ALL_READ') {
      NotificationService.markAllAsRead({
        id: authResult.user.id,
        role: authResult.user.role,
        branch_id: authResult.user.branch_id,
      });
      return NextResponse.json({ success: true, message: 'All notifications marked as read.' });
    } else if (action === 'MARK_READ' && notificationId) {
      NotificationService.markAsRead(notificationId);
      return NextResponse.json({ success: true, message: 'Notification marked as read.' });
    }

    return NextResponse.json({ success: false, error: 'Invalid notification action.' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
