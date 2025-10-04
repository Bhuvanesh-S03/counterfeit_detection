import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/data/latest.dart' as tz;
import 'package:timezone/timezone.dart' as tz;
import 'package:cloud_firestore/cloud_firestore.dart';

class NotificationService {
  final FlutterLocalNotificationsPlugin flutterLocalNotificationsPlugin =
      FlutterLocalNotificationsPlugin();

  // Singleton pattern
  static final NotificationService _notificationService =
      NotificationService._internal();
  factory NotificationService() {
    return _notificationService;
  }
  NotificationService._internal();

  Future<void> init() async {
    const AndroidInitializationSettings initializationSettingsAndroid =
        AndroidInitializationSettings('@mipmap/ic_launcher');

    const DarwinInitializationSettings initializationSettingsIOS =
        DarwinInitializationSettings();

    const InitializationSettings initializationSettings =
        InitializationSettings(
      android: initializationSettingsAndroid,
      iOS: initializationSettingsIOS,
    );

    tz.initializeTimeZones();

    await flutterLocalNotificationsPlugin.initialize(initializationSettings);
  }

  // Modified to accept a Firestore document snapshot
  Future<void> scheduleExpiryNotification({
    required DocumentSnapshot productSnapshot,
    required String title,
    required String body,
  }) async {
    final productData = productSnapshot.data() as Map<String, dynamic>;
    final expiryDateString =
        productData['expiryDate'] as String; // Assuming expiryDate is a string
    final expiryDate = DateTime.tryParse(expiryDateString);

    if (expiryDate == null) {
      return;
    }

    // Notify 7 days before expiry
    final scheduleTime = expiryDate.subtract(const Duration(days: 7));

    // Ensure the notification is scheduled for a future time
    if (scheduleTime.isBefore(DateTime.now())) {
      return;
    }

    await flutterLocalNotificationsPlugin.zonedSchedule(
      // Use the product's unique Firestore document ID as the notification ID
      productSnapshot.id.hashCode,
      title,
      body,
      tz.TZDateTime.from(scheduleTime, tz.local),
      const NotificationDetails(
        android: AndroidNotificationDetails(
          'expiry_channel_id',
          'Expiry Notifications',
          channelDescription: 'Notifications for expiring products',
          importance: Importance.max,
          priority: Priority.high,
        ),
      ),
      androidScheduleMode: AndroidScheduleMode.exactAllowWhileIdle,
    );
  }
}
