// auth_screen.dart
import 'dart:ui';
import 'package:drug_authentication/lottieTransition.dart'; // Assuming this exists
import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart'; // Assuming this exists
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'custom_particle_widget.dart'; // Assuming this exists
import 'home_screen.dart'; // Assuming this exists
import 'main.dart'; // Assuming this exists and handles locale setting

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen>
    with SingleTickerProviderStateMixin {
  final _auth = FirebaseAuth.instance;
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _nameController = TextEditingController(); // For signup
  final _ageController = TextEditingController(); // For signup

  int _tabIndex = 0; // 0 for Login, 1 for Sign Up
  bool _isLoading = false;
  String? _errorMessage;
  bool _isPasswordVisible = false; // Added for password visibility toggle

  late AnimationController _buttonAnimController;
  final GlobalKey<FormState> _loginFormKey = GlobalKey<FormState>();
  final GlobalKey<FormState> _signUpFormKey = GlobalKey<FormState>();

  @override
  void initState() {
    super.initState();
    _buttonAnimController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _nameController.dispose();
    _ageController.dispose();
    _buttonAnimController.dispose();
    super.dispose();
  }

  /// Authenticates the user based on the current tab (login or signup).
  /// Handles Firebase authentication, FCM token saving, and error reporting.
  Future<void> _authenticate() async {
    // Prevent multiple authentications while one is in progress
    if (_isLoading) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null; // Clear previous error messages
    });

    try {
      if (_tabIndex == 0) {
        // Login Logic
        if (!_loginFormKey.currentState!.validate()) {
          // If validation fails, stop loading and return
          setState(() {
            _isLoading = false;
          });
          return;
        }
        await _auth.signInWithEmailAndPassword(
          email: _emailController.text.trim(),
          password: _passwordController.text.trim(),
        );
      } else {
        // Sign Up Logic
        if (!_signUpFormKey.currentState!.validate()) {
          // If validation fails, stop loading and return
          setState(() {
            _isLoading = false;
          });
          return;
        }
        // Create user with email and password
        await _auth.createUserWithEmailAndPassword(
          email: _emailController.text.trim(),
          password: _passwordController.text.trim(),
        );

        // After successful signup, update user profile (e.g., display name)
        final user = _auth.currentUser;
        if (user != null) {
          await user.updateDisplayName(_nameController.text.trim());
          // Save user data and assign 'customer' role to Firestore during signup
          await FirebaseFirestore.instance
              .collection('users')
              .doc(user.uid)
              .set({
            'name': _nameController.text.trim(),
            'age': int.tryParse(_ageController.text.trim()),
            'email': _emailController.text.trim(),
            'role': 'customer', // Assign the 'customer' role here
          }, SetOptions(merge: true));
        }
      }

      // After successful authentication (login or signup), get FCM token and save it to Firestore
      final user = _auth.currentUser;
      if (user != null) {
        final fcmToken = await FirebaseMessaging.instance.getToken();
        if (fcmToken != null) {
          await FirebaseFirestore.instance
              .collection('users')
              .doc(user.uid)
              .set({
            'fcmToken': fcmToken,
          }, SetOptions(merge: true));
        }
      }

      // Play transition and navigate to home screen
      await _playTransitionAndNavigate();
    } on FirebaseAuthException catch (e) {
      // Handle Firebase specific errors
      setState(() {
        _errorMessage = _getFirebaseErrorMessage(e.code);
        _isLoading = false;
      });
    } catch (e) {
      // Handle any other unexpected errors
      setState(() {
        _errorMessage = e.toString();
        _isLoading = false;
      });
    }
  }

  /// Maps Firebase authentication error codes to user-friendly messages.
  String _getFirebaseErrorMessage(String code) {
    switch (code) {
      case 'weak-password':
        return 'The password provided is too weak. It should be at least 6 characters long.';
      case 'email-already-in-use':
        return 'An account already exists for that email. Please try logging in or use a different email.';
      case 'user-not-found':
        return 'No user found for that email. Please check your email or sign up.';
      case 'wrong-password':
        return 'Incorrect password. Please try again.';
      case 'invalid-email':
        return 'The email address is not valid.';
      case 'operation-not-allowed':
        return 'Email/Password authentication is not enabled. Please contact support.';
      default:
        return 'An unknown error occurred. Please try again later.';
    }
  }

  /// Plays a Lottie transition and then navigates to the HomeScreen.
  Future<void> _playTransitionAndNavigate() async {
    await Navigator.push(
      context,
      PageRouteBuilder(
        opaque: false,
        pageBuilder: (context, animation, secondaryAnimation) =>
            const LottieTransitionScreen(), // Ensure this screen exists
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          return FadeTransition(opacity: animation, child: child);
        },
      ),
    );
    // Replace the current screen with HomeScreen to prevent going back to AuthScreen
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
          builder: (context) => const HomeScreen()), // Ensure HomeScreen exists
    );
  }

  /// Handles "Forgot Password" functionality.
  Future<void> _resetPassword(AppLocalizations localizations) async {
    if (_emailController.text.trim().isEmpty) {
      setState(() {
        _errorMessage = localizations.emailRequiredForPasswordReset;
      });
      return;
    }
    try {
      setState(() {
        _isLoading = true;
        _errorMessage = null;
      });
      await _auth.sendPasswordResetEmail(email: _emailController.text.trim());
      setState(() {
        _errorMessage =
            'Password reset email sent to ${_emailController.text.trim()}';
        _isLoading = false;
      });
    } on FirebaseAuthException catch (e) {
      setState(() {
        _errorMessage = _getFirebaseErrorMessage(e.code);
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = 'Failed to send reset email: ${e.toString()}';
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    return Scaffold(
      backgroundColor: const Color(0xFF1A1A2E), // Dark background for contrast
      body: Stack(
        children: [
          // Background particles animation
          const ParticlesWidget(
            numberOfParticles: 100,
            baseColor: Colors.purple,
          ),
          Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // Language selection dropdown
                  _buildLanguageDropdown(context, localizations),
                  const SizedBox(height: 50),
                  // Glassmorphic authentication container
                  _buildGlassmorphicContainer(localizations),
                  const SizedBox(height: 20),
                  // Display error message if any
                  if (_errorMessage != null)
                    Text(
                      _errorMessage!,
                      style: const TextStyle(
                          color: Colors.redAccent, fontSize: 14),
                      textAlign: TextAlign.center,
                    ),
                ],
              ),
            ),
          ),
          // Loading overlay to block interaction while authenticating
          if (_isLoading)
            Container(
              color: Colors.black.withOpacity(0.5),
              child: const Center(
                child: CircularProgressIndicator(
                  valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                ),
              ),
            ),
        ],
      ),
    );
  }

  /// Builds the language selection dropdown.
  Widget _buildLanguageDropdown(
      BuildContext context, AppLocalizations localizations) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.end,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.1),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: Colors.white.withOpacity(0.2)),
            boxShadow: [
              BoxShadow(
                color: Colors.purple.withOpacity(0.4),
                blurRadius: 15,
                spreadRadius: 2,
              ),
            ],
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: localizations.localeName,
              dropdownColor: const Color(0xFF1A1A2E),
              style: const TextStyle(color: Colors.white),
              icon: const Icon(Icons.language_outlined, color: Colors.white),
              items: const [
                DropdownMenuItem(value: 'en', child: Text('English')),
                DropdownMenuItem(value: 'hi', child: Text('हिन्दी')),
                DropdownMenuItem(value: 'ta', child: Text('தமிழ்')),
              ],
              onChanged: (String? newValue) {
                if (newValue != null) {
                  MyApp.setLocale(context, Locale(newValue));
                }
              },
            ),
          ),
        ),
      ],
    );
  }

  /// Builds the glassmorphic container for authentication forms.
  Widget _buildGlassmorphicContainer(AppLocalizations localizations) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(24),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.1),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(
              color: Colors.white.withOpacity(0.2),
            ),
            gradient: LinearGradient(
              colors: [
                Colors.purple.shade400.withOpacity(0.3),
                Colors.pink.shade400.withOpacity(0.3),
              ],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.blue.withOpacity(0.3),
                blurRadius: 30,
                spreadRadius: 5,
              ),
            ],
          ),
          child: Column(
            children: [
              _buildTabSelector(localizations),
              const SizedBox(height: 24),
              if (_tabIndex == 0) _buildLoginForm(localizations),
              if (_tabIndex == 1) _buildSignUpForm(localizations),
              const SizedBox(height: 24),
              _buildAnimatedButton(localizations),
              if (_tabIndex == 0) // Only show "Forgot Password" on login tab
                TextButton(
                  onPressed:
                      _isLoading ? null : () => _resetPassword(localizations),
                  child: Text(
                    localizations.forgotPassword, // Add to AppLocalizations
                    style: TextStyle(
                      color: Colors.white.withOpacity(0.8),
                      fontSize: 14,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  /// Builds the tab selector for Login/Sign Up.
  Widget _buildTabSelector(AppLocalizations localizations) {
    return Row(
      children: [
        Expanded(
          child: GestureDetector(
            onTap: () => setState(() {
              _tabIndex = 0;
              _errorMessage = null; // Clear error when switching tabs
              _loginFormKey.currentState?.reset(); // Clear form fields
              _passwordController.clear(); // Clear password when switching tabs
              _emailController.clear(); // Clear email when switching tabs
              _nameController.clear(); // Clear name field
              _ageController.clear(); // Clear age field
              _isPasswordVisible = false; // Reset password visibility
            }),
            child: _buildTab(localizations.loginTab, _tabIndex == 0),
          ),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: GestureDetector(
            onTap: () => setState(() {
              _tabIndex = 1;
              _errorMessage = null; // Clear error when switching tabs
              _signUpFormKey.currentState?.reset(); // Clear form fields
              _passwordController.clear(); // Clear password when switching tabs
              _emailController.clear(); // Clear email when switching tabs
              _nameController.clear(); // Clear name field
              _ageController.clear(); // Clear age field
              _isPasswordVisible = false; // Reset password visibility
            }),
            child: _buildTab(localizations.signUpTab, _tabIndex == 1),
          ),
        ),
      ],
    );
  }

  /// Builds a single tab button.
  Widget _buildTab(String text, bool isSelected) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeInOut,
      alignment: Alignment.center,
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(
        color: isSelected ? Colors.white.withOpacity(0.15) : Colors.transparent,
        borderRadius: BorderRadius.circular(16),
        border: isSelected
            ? Border.all(color: Colors.white.withOpacity(0.4))
            : null,
      ),
      child: Text(
        text,
        style: TextStyle(
          color: isSelected ? Colors.white : Colors.white.withOpacity(0.7),
          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
        ),
      ),
    );
  }

  /// Builds the login form.
  Widget _buildLoginForm(AppLocalizations localizations) {
    return Form(
      key: _loginFormKey,
      child: Column(
        children: [
          _buildTextFormField(
            controller: _emailController,
            label: localizations.emailLabel,
            icon: Icons.email,
            keyboardType: TextInputType.emailAddress,
            validator: (value) {
              if (value == null || value.isEmpty) {
                return localizations.fieldRequired;
              }
              if (!RegExp(r'\S+@\S+\.\S+').hasMatch(value)) {
                return localizations.invalidEmail;
              }
              return null;
            },
          ),
          const SizedBox(height: 16),
          _buildTextFormField(
            controller: _passwordController,
            label: localizations.passwordLabel,
            icon: Icons.lock,
            isPassword: !_isPasswordVisible, // Use the state variable
            suffixIcon: IconButton(
              icon: Icon(
                _isPasswordVisible ? Icons.visibility : Icons.visibility_off,
                color: Colors.blue.shade300,
              ),
              onPressed: () {
                setState(() {
                  _isPasswordVisible = !_isPasswordVisible;
                });
              },
            ),
            validator: (value) {
              if (value == null || value.isEmpty) {
                return localizations.fieldRequired;
              }
              return null;
            },
          ),
        ],
      ),
    );
  }

  /// Builds the sign up form.
  Widget _buildSignUpForm(AppLocalizations localizations) {
    return Form(
      key: _signUpFormKey,
      child: Column(
        children: [
          _buildTextFormField(
            controller: _nameController,
            label: localizations.nameLabel,
            icon: Icons.person,
            validator: (value) {
              if (value == null || value.isEmpty) {
                return localizations.fieldRequired;
              }
              return null;
            },
          ),
          const SizedBox(height: 16),
          _buildTextFormField(
            controller: _ageController,
            label: localizations.ageLabel,
            icon: Icons.cake,
            keyboardType: TextInputType.number,
            validator: (value) {
              if (value == null || value.isEmpty) {
                return localizations.fieldRequired;
              }
              if (int.tryParse(value) == null || int.parse(value) <= 0) {
                return localizations.invalidAge;
              }
              return null;
            },
          ),
          const SizedBox(height: 16),
          _buildTextFormField(
            controller: _emailController,
            label: localizations.emailLabel,
            icon: Icons.email,
            keyboardType: TextInputType.emailAddress,
            validator: (value) {
              if (value == null || value.isEmpty) {
                return localizations.fieldRequired;
              }
              if (!RegExp(r'\S+@\S+\.\S+').hasMatch(value)) {
                return localizations.invalidEmail;
              }
              return null;
            },
          ),
          const SizedBox(height: 16),
          _buildTextFormField(
            controller: _passwordController,
            label: localizations.passwordLabel,
            icon: Icons.lock,
            isPassword: !_isPasswordVisible, // Use the state variable
            suffixIcon: IconButton(
              icon: Icon(
                _isPasswordVisible ? Icons.visibility : Icons.visibility_off,
                color: Colors.blue.shade300,
              ),
              onPressed: () {
                setState(() {
                  _isPasswordVisible = !_isPasswordVisible;
                });
              },
            ),
            validator: (value) {
              if (value == null || value.isEmpty) {
                return localizations.fieldRequired;
              }
              if (value.length < 6) {
                return localizations.passwordLength;
              }
              return null;
            },
          ),
        ],
      ),
    );
  }

  /// Builds a custom text form field with styling and validation.
  Widget _buildTextFormField({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    bool isPassword = false,
    TextInputType keyboardType = TextInputType.text,
    String? Function(String?)? validator,
    Widget? suffixIcon, // Added for password visibility toggle
  }) {
    return TextFormField(
      controller: controller,
      obscureText: isPassword,
      keyboardType: keyboardType,
      style: const TextStyle(color: Colors.white),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: TextStyle(color: Colors.white.withOpacity(0.7)),
        prefixIcon: Icon(icon, color: Colors.blue.shade300),
        suffixIcon: suffixIcon, // Apply the suffix icon
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: Colors.white.withOpacity(0.3)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: Colors.blue.shade300, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Colors.redAccent, width: 2),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Colors.redAccent, width: 2),
        ),
        fillColor: Colors.white.withOpacity(0.05),
        filled: true,
      ),
      validator: validator,
    );
  }

  /// Builds the animated authentication button.
  Widget _buildAnimatedButton(AppLocalizations localizations) {
    return AnimatedBuilder(
      animation: _buttonAnimController,
      builder: (context, child) {
        final glowValue =
            Curves.easeInOut.transform(_buttonAnimController.value);
        return AbsorbPointer(
          // Disable button interaction if loading
          absorbing: _isLoading,
          child: GestureDetector(
            onTapDown: (_) {
              if (!_isLoading) _buttonAnimController.forward();
            },
            onTapUp: (_) {
              if (!_isLoading) _buttonAnimController.reverse();
            },
            onTapCancel: () {
              if (!_isLoading) _buttonAnimController.reverse();
            },
            onTap:
                _isLoading ? null : _authenticate, // Disable onTap when loading
            child: Container(
              alignment: Alignment.center,
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    Colors.blue.shade600.withOpacity(0.5 + 0.5 * glowValue),
                    Colors.purple.shade600.withOpacity(0.5 + 0.5 * glowValue),
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: Colors.white.withOpacity(0.4 + 0.6 * glowValue),
                  width: 2,
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.blue.shade300.withOpacity(0.5),
                    blurRadius: 20 * glowValue,
                    spreadRadius: 5 * glowValue,
                  ),
                ],
              ),
              child: Text(
                _tabIndex == 0
                    ? localizations.loginButton
                    : localizations.signUpButton,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
