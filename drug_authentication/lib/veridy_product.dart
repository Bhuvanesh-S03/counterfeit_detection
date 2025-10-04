import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'package:drug_authentication/report_page.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:mime/mime.dart';
import 'package:http_parser/http_parser.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'custom_particle_widget.dart';
import 'notification_serivce.dart';

// Enum to manage the verification state
enum VerificationState { initial, verifying, verified, error }

// Base URL of your Python backend
const String baseUrl = 'https://counterfeit-detection-1.onrender.com';

class VerifyProductPage extends StatefulWidget {
  const VerifyProductPage({super.key});

  @override
  State<VerifyProductPage> createState() => _VerifyProductPageState();
}

class _VerifyProductPageState extends State<VerifyProductPage>
    with TickerProviderStateMixin {
  VerificationState _currentState = VerificationState.initial;
  String? _errorMessage;
  Map<String, dynamic>? _productData;
  File? _selectedImage;
  String? _decodedHash;
  String? _reportText; // New variable to hold the generated report message

  // Animation controllers
  late AnimationController _scanAnimationController;
  late AnimationController _progressAnimationController;
  late Animation<double> _scanAnimation;
  late Animation<double> _progressAnimation;
  late AnimationController _backgroundAnimationController;
  late Animation<Color?> _backgroundColorAnimation;

  @override
  void initState() {
    super.initState();
    _scanAnimationController = AnimationController(
      duration: const Duration(seconds: 2),
      vsync: this,
    );
    _progressAnimationController = AnimationController(
      duration: const Duration(seconds: 3),
      vsync: this,
    );
    _backgroundAnimationController = AnimationController(
      duration: const Duration(milliseconds: 500),
      vsync: this,
    );

    _scanAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
          parent: _scanAnimationController, curve: Curves.easeInOut),
    );
    // CHANGE: Progress animation now goes from 0.0 to 1.0 for left-to-right
    _progressAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
          parent: _progressAnimationController, curve: Curves.linear),
    );
    _backgroundColorAnimation = ColorTween(
      begin: const Color(0xFF0A0A2E),
      end: const Color(0xFF0A0A2E),
    ).animate(_backgroundAnimationController);
  }

  @override
  void dispose() {
    _scanAnimationController.dispose();
    _progressAnimationController.dispose();
    _backgroundAnimationController.dispose();
    super.dispose();
  }

  Future<void> _pickImageFromCamera() async {
    final picker = ImagePicker();
    final pickedFile = await picker.pickImage(source: ImageSource.camera);

    if (pickedFile != null) {
      _startVerification(File(pickedFile.path));
    }
  }

  Future<void> _pickImageFromGallery() async {
    final picker = ImagePicker();
    final pickedFile = await picker.pickImage(source: ImageSource.gallery);

    if (pickedFile != null) {
      _startVerification(File(pickedFile.path));
    }
  }

  void _startVerification(File imageFile) {
    if (!mounted) return;
    setState(() {
      _selectedImage = imageFile;
      _currentState = VerificationState.verifying;
      _errorMessage = null;
      _productData = null;
      _decodedHash = null;
      _reportText = null; // Reset report text
      _animateBackground(const Color(0xFF0A0A2E)); // Reset background color
    });

    // Start animations
    _scanAnimationController.forward();
    _progressAnimationController.forward();

    _decodeAndVerify();
  }

  void _animateBackground(Color targetColor) {
    _backgroundColorAnimation = ColorTween(
      begin: _backgroundColorAnimation.value,
      end: targetColor,
    ).animate(_backgroundAnimationController);
    _backgroundAnimationController.forward(from: 0.0);
  }

  Future<void> _decodeAndVerify() async {
    final localizations = AppLocalizations.of(context)!;
    if (_selectedImage == null) return;

    try {
      // Step 1: Decode the watermark to get the hash
      var request = http.MultipartRequest(
        'POST',
        Uri.parse('$baseUrl/decode_robust_watermark'),
      );
      final mimeType = lookupMimeType(_selectedImage!.path);
      request.files.add(
        await http.MultipartFile.fromPath(
          'file',
          _selectedImage!.path,
          contentType: mimeType != null ? MediaType.parse(mimeType) : null,
        ),
      );

      var response = await request.send();
      final responseBody = await response.stream.bytesToString();

      if (!mounted) return;

      print('--- Backend Response 1 (decode_robust_watermark) ---');
      print('Status Code: ${response.statusCode}');
      print('Response Body: ${responseBody}');
      print('----------------------------------------------------');

      if (response.statusCode != 200) {
        var errorDetail = localizations.serverError;
        try {
          final errorData = json.decode(responseBody);
          errorDetail = errorData['detail'];

          // Case 1: Watermark is not found or is corrupted
          if (errorDetail ==
              "Watermark not found or is too corrupted to decode.") {
            if (!mounted) return;
            setState(() {
              _errorMessage = localizations.noWatermarkFound;
              _currentState = VerificationState
                  .verified; // Change to verified to show report button
              _productData = {'isCounterfeit': true, 'reason': errorDetail};
              _reportText =
                  'Report: This product\'s image appears to be damaged or lacks a valid watermark. The server was unable to decode the embedded hash.';
            });
            _stopAnimations();
            _animateBackground(Colors.red.withOpacity(0.3));
            return;
          }
        } catch (_) {
          errorDetail = responseBody;
        }
        _stopAnimations();
        _animateBackground(Colors.red.withOpacity(0.3));
        throw Exception(
            '${localizations.serverError} (${response.statusCode}): $errorDetail');
      }

      final decodedData = json.decode(responseBody);
      final decodedHash = decodedData['decoded_hash'] as String?;

      if (decodedHash == null ||
          decodedHash.isEmpty ||
          decodedHash ==
              '0x0000000000000000000000000000000000000000000000000000000000000000') {
        if (!mounted) return;
        setState(() {
          _productData = {
            'isCounterfeit': true,
            'reason': 'Decoded hash is not a valid value.'
          };
          _currentState = VerificationState.verified;
          _reportText =
              'Report: A hash was decoded from this product, but it is not a valid or known value. This suggests the product may be counterfeit.';
        });
        _stopAnimations();
        _animateBackground(Colors.red.withOpacity(0.3));
        return;
      }
      _decodedHash = decodedHash;

      // Step 2: Use the decoded hash to get product details
      final detailsResponse = await http.get(
        Uri.parse(
            '$baseUrl/view_product_details/${decodedHash.replaceFirst("0x", "")}'),
      );

      if (!mounted) return;

      print('--- Backend Response 2 (view_product_details) ---');
      print('Status Code: ${detailsResponse.statusCode}');
      print('Response Body: ${detailsResponse.body}');
      print('----------------------------------------------------');

      if (detailsResponse.statusCode != 200) {
        final errorBody = detailsResponse.body;
        var errorDetail = localizations.serverError;
        try {
          final errorData = json.decode(errorBody);
          errorDetail = errorData['detail'];

          // Case 2: Product hash not found on the blockchain
          if (errorDetail.contains("Product not found on the blockchain.")) {
            if (!mounted) return;
            setState(() {
              _productData = {'isCounterfeit': true, 'reason': errorDetail};
              _currentState = VerificationState.verified;
              _reportText =
                  'Report: The unique identifier for this product was not found on the blockchain. This strongly suggests it is a counterfeit.';
            });
            _stopAnimations();
            _animateBackground(Colors.red.withOpacity(0.3));
            return;
          }
        } catch (_) {
          errorDetail = errorBody;
        }
        _stopAnimations();
        _animateBackground(Colors.red.withOpacity(0.3));
        throw Exception(
            '${localizations.serverError} (${detailsResponse.statusCode}): $errorDetail');
      }

      final productDetailsData = json.decode(detailsResponse.body);

      if (!mounted) return;
      setState(() {
        _productData = productDetailsData;
        _currentState = VerificationState.verified;
      });
      _stopAnimations();

      if (_productData!['isCounterfeit'] == true ||
          _productData!['productDetailsFromIPFS'] == null) {
        _animateBackground(Colors.red.withOpacity(0.3));
        _reportText =
            'Report: This product appears to be a counterfeit due to missing or invalid IPFS data associated with the blockchain hash.';
      } else if (_productData!['qcStatus'] == 'NOT STANDARD ❌') {
        _animateBackground(Colors.orange.withOpacity(0.3));
        // Case 3: QC status is not standard
        _reportText =
            'Report: This product is authentic, but its batch (${_productData!['batchNumber']}) has been marked as \'NOT STANDARD\' in a recent quality control submission.';
      } else {
        _animateBackground(const Color(0xFF00FF88).withOpacity(0.3));
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage =
            "${localizations.verificationErrorTitle}: ${e.toString()}";
        _currentState = VerificationState.error;
      });
      _stopAnimations();
      _animateBackground(Colors.red.withOpacity(0.3));
    }
  }

  void _stopAnimations() {
    _scanAnimationController.stop();
    _progressAnimationController.stop();
  }

  Future<void> _saveProduct() async {
    final localizations = AppLocalizations.of(context)!;
    if (_productData == null || _decodedHash == null) return;

    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        _buildFuturisticSnackBar(
            "You must be logged in to save a product.", Colors.red),
      );
      return;
    }

    final productDetailsFromIPFS =
        _productData!['productDetailsFromIPFS'] as Map<String, dynamic>?;
    final batchNumber = _productData!['batchNumber'] as String?;

    if (productDetailsFromIPFS == null || batchNumber == null) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        _buildFuturisticSnackBar(
            "Cannot save a product with incomplete details.", Colors.red),
      );
      return;
    }

    try {
      String overallStatus;
      if (_productData!['isCounterfeit'] == true ||
          _productData!['productDetailsFromIPFS'] == null) {
        overallStatus = 'COUNTERFEIT ❌';
      } else if (_productData!['qcStatus'] == 'NOT STANDARD ❌') {
        overallStatus = 'QC_FAIL ❌';
      } else {
        overallStatus = 'SAFE_TO_EAT ✅';
      }

      // Save to a top-level 'scans' collection
      final docRef = FirebaseFirestore.instance.collection('scans').doc();

      await docRef.set({
        'userId': user.uid,
        'productHash': _decodedHash,
        'productName': productDetailsFromIPFS['productName'] ?? "Unknown",
        'expiryDate': productDetailsFromIPFS['expiryDate'] ?? "Unknown",
        'mfgDate': productDetailsFromIPFS['mfgDate'] ?? "Unknown",
        'mfgCompany': productDetailsFromIPFS['mfgCompany'] ?? "Unknown",
        'qcStatus': _productData!['qcStatus'] ?? "Unknown",
        'overallStatus': overallStatus,
        'batchNumber': batchNumber,
        'timestamp': FieldValue.serverTimestamp(),
      });

      final productDoc = await docRef.get();

      if (overallStatus == 'SAFE_TO_EAT ✅' && productDoc.exists) {
        final expiryDateString = productDetailsFromIPFS['expiryDate'];
        if (expiryDateString != null) {
          NotificationService().scheduleExpiryNotification(
            productSnapshot: productDoc,
            title: 'Product Expiry Alert',
            body:
                'Your ${productDetailsFromIPFS['productName'] ?? "product"} is expiring soon!',
          );
        }
      }

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        _buildFuturisticSnackBar(
          '${productDetailsFromIPFS['productName'] ?? "Product"} ${localizations.saveProductSuccess}',
          const Color(0xFF00FF88),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        _buildFuturisticSnackBar(
            '${localizations.saveProductFailure}: $e', Colors.red),
      );
    }
  }

  void _reportProduct() {
    // We now have a pre-generated report message in _reportText.
    final productHash = _decodedHash;
    final overallStatus = _productData?['qcStatus'] as String?;
    final productName =
        _productData?['productDetailsFromIPFS']?['productName'] as String?;

    // Pass the pre-generated report text to the ReportProductPage
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => ReportProductPage(
          productHash: productHash,
          productName: productName,
          status: overallStatus,
          reportText: _reportText, // Pass the new report text
        ),
      ),
    );
  }

  void _reset() {
    if (!mounted) return;
    setState(() {
      _currentState = VerificationState.initial;
      _errorMessage = null;
      _productData = null;
      _selectedImage = null;
      _decodedHash = null;
      _reportText = null; // Reset report text on reset
    });
    _scanAnimationController.reset();
    _progressAnimationController.reset();
    _animateBackground(const Color(0xFF0A0A2E));
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    return AnimatedBuilder(
      animation: _backgroundColorAnimation,
      builder: (context, child) {
        return Scaffold(
          backgroundColor: _backgroundColorAnimation.value,
          appBar: _buildFuturisticAppBar(localizations.verifyProductTitle),
          body: Stack(
            children: [
              // Original particle widget with reduced opacity
              const Opacity(
                opacity: 0.3,
                child: ParticlesWidget(
                  numberOfParticles: 50,
                  baseColor: Colors.cyan,
                ),
              ),
              // Main content
              // Removed SingleChildScrollView
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const SizedBox(height: 10), // Reduced space above the photo
                    // Central scan area
                    _buildCentralScanArea(localizations),
                    const SizedBox(height: 15), // Reduced space
                    // Content based on state
                    if (_currentState == VerificationState.initial) ...[
                      _buildInitialState(localizations),
                      const SizedBox(height: 10), // Reduced space
                      _buildFuturisticButton(
                        onPressed: _pickImageFromGallery,
                        icon: Icons.photo_library,
                        label: 'Select from Gallery',
                        color: const Color(0xFF0080FF),
                      ),
                    ],
                    if (_currentState == VerificationState.verifying)
                      _buildVerifyingState(localizations),
                    if (_errorMessage != null) _buildErrorState(localizations),
                    if (_currentState == VerificationState.verified &&
                        _productData != null)
                      _buildProductDetails(localizations),
                    if (_currentState == VerificationState.verified &&
                        _productData == null)
                      _buildFuturisticInfoCard(
                        icon: Icons.error_outline,
                        iconColor: Colors.red,
                        title: localizations.verificationErrorTitle,
                        content: Text(
                          localizations.failedToFetchDetails,
                          style: const TextStyle(color: Colors.white70),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  PreferredSizeWidget _buildFuturisticAppBar(String title) {
    return AppBar(
      title: Text(
        title,
        style: const TextStyle(
          fontFamily: 'monospace',
          fontWeight: FontWeight.bold,
          color: Colors.white,
          fontSize: 18,
        ),
      ),
      backgroundColor: Colors.transparent, // Make it transparent
      elevation: 0,
      flexibleSpace: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [
              const Color(0xFF0A0A2E).withOpacity(0.9),
              const Color(0xFF16213E).withOpacity(0.9),
            ],
          ),
          border: Border(
            bottom: BorderSide(
              color: const Color(0xFF00FF88).withOpacity(0.3),
              width: 1,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildCentralScanArea(AppLocalizations localizations) {
    return GestureDetector(
      onTap: _currentState == VerificationState.initial
          ? _pickImageFromCamera
          : null,
      child: Container(
        height: 250,
        margin: const EdgeInsets.symmetric(horizontal: 40),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Colors.white.withOpacity(0.1),
              Colors.white.withOpacity(0.05),
            ],
          ),
          border: Border.all(
            color: const Color(0xFF00FF88).withOpacity(0.3),
            width: 2,
          ),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF00FF88).withOpacity(0.2),
              blurRadius: 20,
              spreadRadius: 2,
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(18),
          child: Stack(
            children: [
              // Background pattern
              Positioned.fill(
                child: CustomPaint(
                  painter: StencilPatternPainter(),
                ),
              ),
              // Scanner animation overlay
              if (_currentState == VerificationState.verifying)
                AnimatedBuilder(
                  animation: _scanAnimation,
                  builder: (context, child) {
                    return Positioned(
                      top: _scanAnimation.value * 210,
                      left: 0,
                      right: 0,
                      child: Container(
                        height: 2,
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              Colors.transparent,
                              const Color(0xFF00FF88).withOpacity(0.8),
                              Colors.transparent,
                            ],
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFF00FF88).withOpacity(0.6),
                              blurRadius: 10,
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              // Content
              Center(
                child: _selectedImage != null
                    ? ClipRRect(
                        borderRadius: BorderRadius.circular(16),
                        child: Image.file(
                          _selectedImage!,
                          fit: BoxFit.contain,
                          width: double.infinity,
                          height: double.infinity,
                        ),
                      )
                    : Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Container(
                            padding: const EdgeInsets.all(20),
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              gradient: RadialGradient(
                                colors: [
                                  const Color(0xFF00FF88).withOpacity(0.2),
                                  Colors.transparent,
                                ],
                              ),
                            ),
                            child: const Icon(
                              Icons.camera_alt_outlined,
                              size: 60,
                              color: Color(0xFF00FF88),
                            ),
                          ),
                          const SizedBox(height: 16),
                          Text(
                            'TAP TO SCAN (CAMERA)',
                            style: TextStyle(
                              fontFamily: 'monospace',
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: const Color(0xFF00FF88),
                              letterSpacing: 2,
                            ),
                          ),
                        ],
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildInitialState(AppLocalizations localizations) {
    return Column(
      children: [
        Text(
          localizations.verifyProductMessage,
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontSize: 16,
            color: Colors.white70,
            fontFamily: 'monospace',
          ),
        ),
        const SizedBox(height: 30),
      ],
    );
  }

  Widget _buildVerifyingState(AppLocalizations localizations) {
    return Column(
      children: [
        Text(
          'SCANNING IN PROGRESS...',
          style: TextStyle(
            fontFamily: 'monospace',
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: const Color(0xFF00FF88),
            letterSpacing: 2,
          ),
        ),
        const SizedBox(height: 20),
        _buildFuturisticProgressBar(),
        const SizedBox(height: 20),
        Text(
          'Analyzing blockchain signature...',
          style: TextStyle(
            fontFamily: 'monospace',
            fontSize: 14,
            color: Colors.white60,
          ),
        ),
      ],
    );
  }

  Widget _buildFuturisticProgressBar() {
    return Container(
      height: 8,
      margin: const EdgeInsets.symmetric(horizontal: 40),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(4),
        color: Colors.white.withOpacity(0.1),
      ),
      child: AnimatedBuilder(
        animation: _progressAnimation,
        builder: (context, child) {
          return Align(
            alignment: Alignment.centerLeft,
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(4),
                gradient: LinearGradient(
                  colors: [
                    const Color(0xFF00FF88),
                    const Color(0xFF0080FF),
                  ],
                  begin: Alignment.centerLeft,
                  end: Alignment.centerRight,
                ),
              ),
              width: MediaQuery.of(context).size.width *
                  0.6 *
                  _progressAnimation.value,
            ),
          );
        },
      ),
    );
  }

  Widget _buildErrorState(AppLocalizations localizations) {
    return Column(
      children: [
        _buildFuturisticInfoCard(
          icon: Icons.error_outline,
          iconColor: Colors.red,
          title: localizations.verificationErrorTitle,
          content: Text(
            _errorMessage!,
            style: const TextStyle(color: Colors.white70),
          ),
        ),
        const SizedBox(height: 20),
        _buildFuturisticButton(
          onPressed: _reset,
          icon: Icons.refresh,
          label: localizations.tryAgainButton,
          color: const Color(0xFF0080FF),
        ),
      ],
    );
  }

  Widget _buildProductDetails(AppLocalizations localizations) {
    String overallStatus = 'UNKNOWN';
    Color statusColor = Colors.grey;
    IconData statusIcon = Icons.help_outline;

    final isCounterfeit = _productData?['isCounterfeit'] == true;
    final productDetailsFromIPFS = _productData?['productDetailsFromIPFS'];
    final qcStatus = _productData?['qcStatus'] as String? ?? 'No QC data';
    final hasIpfsData = productDetailsFromIPFS != null;
    final isQcStandard = qcStatus.contains('STANDARD');
    final isQcNotStandard = qcStatus.contains('NOT STANDARD');

    // CORRECTED LOGIC: Check for counterfeit first
    if (isCounterfeit || !hasIpfsData) {
      overallStatus = 'COUNTERFEIT ❌';
      statusColor = Colors.red;
      statusIcon = Icons.cancel_outlined;
    } else if (isQcNotStandard) {
      overallStatus = 'NOT SAFE TO EAT ⚠️';
      statusColor = Colors.orange;
      statusIcon = Icons.warning_amber_outlined;
    } else if (isQcStandard) {
      overallStatus = 'SAFE TO EAT ✅';
      statusColor = const Color(0xFF00FF88);
      statusIcon = Icons.check_circle_outline;
    } else {
      overallStatus = 'AUTHENTIC ✅';
      statusColor = const Color(0xFF00FF88);
      statusIcon = Icons.check_circle_outline;
    }

    final showReportButton =
        (isCounterfeit || qcStatus.contains('NOT STANDARD'));

    return Expanded(
      child: Column(
        children: [
          _buildFuturisticInfoCard(
            icon: statusIcon,
            iconColor: statusColor,
            title: overallStatus,
            content: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (overallStatus.contains('COUNTERFEIT'))
                  const Padding(
                    padding: EdgeInsets.only(bottom: 10.0),
                    child: Text(
                      "This product's image contains a hash that was not found on the blockchain. This indicates it may be a counterfeit product.",
                      style: TextStyle(color: Colors.white70),
                    ),
                  ),
                if (!isCounterfeit && hasIpfsData)
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _buildFuturisticDetailRow(
                        localizations.productIDLabel,
                        productDetailsFromIPFS['productId'] ?? "N/A",
                      ),
                      _buildFuturisticDetailRow(
                        localizations.nameLabel,
                        productDetailsFromIPFS['productName'] ?? "N/A",
                      ),
                      _buildFuturisticDetailRow(
                        localizations.expiryLabel,
                        productDetailsFromIPFS['expiryDate'] ?? "N/A",
                      ),
                      _buildFuturisticDetailRow(
                        'Mfg Date',
                        productDetailsFromIPFS['mfgDate'] ?? "N/A",
                      ),
                      _buildFuturisticDetailRow(
                        'Mfg Company',
                        productDetailsFromIPFS['mfgCompany'] ?? "N/A",
                      ),
                      _buildFuturisticDetailRow(
                        'QC Status',
                        qcStatus,
                      ),
                    ],
                  ),
              ],
            ),
          ),
          const SizedBox(height: 15),
          if (!isCounterfeit && !qcStatus.contains('NOT STANDARD'))
            _buildFuturisticButton(
              onPressed: _saveProduct,
              icon: Icons.save,
              label: localizations.saveProductButton,
              color: const Color(0xFF00FF88),
            ),
          if (!isCounterfeit && !qcStatus.contains('NOT STANDARD'))
            const SizedBox(height: 10),
          if (showReportButton) ...[
            _buildFuturisticButton(
              onPressed: _reportProduct,
              icon: Icons.flag,
              label: "Report Product",
              color: overallStatus.contains('COUNTERFEIT')
                  ? Colors.red
                  : Colors.orange,
            ),
            const SizedBox(height: 10),
          ],
          _buildFuturisticButton(
            onPressed: _reset,
            icon: Icons.refresh,
            label: localizations.verifyAnotherButton,
            color: const Color(0xFF0080FF),
          ),
        ],
      ),
    );
  }

  Widget _buildFuturisticButton({
    required VoidCallback onPressed,
    required IconData icon,
    required String label,
    required Color color,
  }) {
    return Container(
      width: double.infinity,
      height: 56,
      margin: const EdgeInsets.symmetric(horizontal: 20),
      child: ElevatedButton.icon(
        onPressed: onPressed,
        icon: Icon(icon, color: Colors.white),
        label: Text(
          label,
          style: const TextStyle(
            fontFamily: 'monospace',
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: Colors.white,
          ),
        ),
        style: ElevatedButton.styleFrom(
          backgroundColor: color.withOpacity(0.2),
          foregroundColor: Colors.white,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: BorderSide(color: color, width: 2),
          ),
        ).copyWith(
          overlayColor: MaterialStateProperty.all(color.withOpacity(0.1)),
        ),
      ),
    );
  }

  Widget _buildFuturisticInfoCard({
    required IconData icon,
    required Color iconColor,
    required String title,
    required Widget content,
  }) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 0),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Colors.white.withOpacity(0.05),
            Colors.white.withOpacity(0.01),
          ],
        ),
        boxShadow: [
          BoxShadow(
            color: iconColor.withOpacity(0.2),
            blurRadius: 15,
            spreadRadius: 2,
          ),
        ],
        border: Border.all(
          color: iconColor.withOpacity(0.4),
          width: 1.5,
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: iconColor, size: 30),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontFamily: 'monospace',
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: iconColor,
                    letterSpacing: 1.5,
                  ),
                ),
                const SizedBox(height: 10),
                content,
              ],
            ),
          ),
        ],
      ),
    );
  }

  SnackBar _buildFuturisticSnackBar(String message, Color color) {
    return SnackBar(
      content: Text(
        message,
        style: TextStyle(
          fontFamily: 'monospace',
          color: color == Colors.red ? Colors.white : Colors.black,
          fontWeight: FontWeight.bold,
        ),
      ),
      backgroundColor: color.withOpacity(0.8),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
      ),
      behavior: SnackBarBehavior.floating,
      duration: const Duration(seconds: 3),
      elevation: 6,
    );
  }

  Widget _buildFuturisticDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            flex: 2,
            child: Text(
              '$label:',
              style: const TextStyle(
                fontFamily: 'monospace',
                fontWeight: FontWeight.bold,
                fontSize: 14,
                color: Colors.white,
              ),
            ),
          ),
          Expanded(
            flex: 3,
            child: Text(
              value,
              style: const TextStyle(
                fontFamily: 'monospace',
                color: Colors.white70,
                fontSize: 14,
              ),
              overflow: TextOverflow.ellipsis,
              maxLines: 2,
            ),
          ),
        ],
      ),
    );
  }
}

class StencilPatternPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white.withOpacity(0.03)
      ..style = PaintingStyle.fill;

    // A list of sample paths representing simple medicine and blockchain icons
    final List<Path> shapes = [
      // Pill shape
      Path()
        ..addRRect(RRect.fromRectAndRadius(
          Rect.fromCenter(center: const Offset(0, 0), width: 10, height: 4),
          const Radius.circular(2),
        ))
        ..addOval(
            Rect.fromCenter(center: const Offset(-5, 0), width: 4, height: 4))
        ..addOval(
            Rect.fromCenter(center: const Offset(5, 0), width: 4, height: 4)),
      // Diamond/Block shape for blockchain
      Path()
        ..moveTo(0, 5)
        ..lineTo(5, 0)
        ..lineTo(0, -5)
        ..lineTo(-5, 0)
        ..close(),
      // Simple DNA helix
      Path()
        ..moveTo(0, 0)
        ..cubicTo(5, -5, 10, 5, 15, 0)
        ..moveTo(0, -5)
        ..cubicTo(5, 0, 10, -10, 15, -5),
    ];

    final random = Random(42);
    final double spacingX = 40;
    final double spacingY = 40;

    for (double y = 0; y < size.height; y += spacingY) {
      for (double x = 0; x < size.width; x += spacingX) {
        final shapeIndex = random.nextInt(shapes.length);
        final shape = shapes[shapeIndex];

        // Apply random rotation and scale
        final double scale = 0.8 + random.nextDouble() * 0.4;
        final double rotation = random.nextDouble() * 2 * pi;

        canvas.save();
        canvas.translate(x, y);
        canvas.rotate(rotation);
        canvas.scale(scale);

        canvas.drawPath(shape, paint);

        canvas.restore();
      }
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) {
    return false;
  }
}
