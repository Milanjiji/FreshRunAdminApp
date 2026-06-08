import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Colors } from '../theme/colors';
import { Fonts } from '../theme/typography';

type AlertButton = {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

let alertListener: any = null;

export const Alertt = {
  alert: (title: string, message?: string, buttons?: AlertButton[]) => {
    if (alertListener) {
      alertListener(title, message, buttons);
    }
  }
};

export const CustomAlert = () => {
  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [buttons, setButtons] = useState<AlertButton[]>([]);
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    alertListener = (t: string, m: string, b: AlertButton[]) => {
      setTitle(t);
      setMessage(m || '');
      setButtons(b || [{ text: 'OK', onPress: () => {} }]);
      setVisible(true);
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    };
    return () => { alertListener = null; };
  }, []);

  const hide = () => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setVisible(false);
    });
  };

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none">
      <View style={styles.overlay}>
        <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ scale: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] }]}>
          <View style={styles.content}>
            <Text style={styles.title}>{title}</Text>
            {message ? <Text style={styles.message}>{message}</Text> : null}
          </View>
          <View style={styles.buttonContainer}>
            {buttons.map((btn, index) => {
              const isDestructive = btn.style === 'destructive';
              const isCancel = btn.style === 'cancel';
              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.button,
                    index > 0 && styles.borderLeft,
                    buttons.length > 2 && styles.verticalButton
                  ]}
                  onPress={() => {
                    hide();
                    if (btn.onPress) btn.onPress();
                  }}
                >
                  <Text style={[
                    styles.buttonText,
                    isDestructive && { color: Colors.error },
                    isCancel && { color: Colors.textSecondary, fontFamily: Fonts.regular }
                  ]}>
                    {btn.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '85%',
    backgroundColor: Colors.surface,
    borderRadius: 24,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
  },
  content: {
    padding: 28,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 10,
  },
  message: {
    fontSize: 15,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  buttonContainer: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  button: {
    flex: 1,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verticalButton: {
    width: '100%',
    borderLeftWidth: 0,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  borderLeft: {
    borderLeftWidth: 1,
    borderLeftColor: Colors.divider,
  },
  buttonText: {
    fontSize: 16,
    fontFamily: Fonts.semiBold,
    color: Colors.primary,
  },
});
