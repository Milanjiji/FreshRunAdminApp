import React from 'react';
import { 
  TouchableOpacity, 
  Text, 
  StyleSheet, 
  ActivityIndicator, 
  TouchableOpacityProps 
} from 'react-native';
import { Fonts } from '../theme/typography';
import { Colors } from '../theme/colors';

interface PrimaryButtonProps extends TouchableOpacityProps {
  title: string;
  loading?: boolean;
}

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({ 
  title, 
  loading, 
  style, 
  ...props 
}) => {
  return (
    <TouchableOpacity 
      style={[styles.button, style]} 
      disabled={loading || props.disabled} 
      {...props}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <Text style={styles.text}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: Colors.primary,
    height: 60,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    elevation: 2,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  text: {
    color: '#fff',
    fontSize: 18,
    fontFamily: Fonts.bold,
    fontWeight: '900',
  },
});
