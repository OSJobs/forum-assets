/*global I18n:true */

// Instantiate the object
var I18n = I18n || {};

// Set default locale to english
I18n.defaultLocale = "en";

// Set default pluralization rule
I18n.pluralizationRules = {
  en: function(n) {
    return n === 0 ? ["zero", "none", "other"] : n === 1 ? "one" : "other";
  }
};

// Set current locale to null
I18n.locale = null;
I18n.fallbackLocale = null;

// Set the placeholder format. Accepts `{{placeholder}}` and `%{placeholder}`.
I18n.PLACEHOLDER = /(?:\{\{|%\{)(.*?)(?:\}\}?)/gm;

I18n.SEPARATOR = ".";

I18n.noFallbacks = false;

I18n.isValidNode = function(obj, node, undefined) {
  return obj[node] !== null && obj[node] !== undefined;
};

I18n.lookup = function(scope, options) {
  options = options || {};

  var translations = this.prepareOptions(I18n.translations),
    locale = options.locale || I18n.currentLocale(),
    messages = translations[locale] || {},
    currentScope;

  options = this.prepareOptions(options);

  if (typeof scope === "object") {
    scope = scope.join(this.SEPARATOR);
  }

  if (options.scope) {
    scope = options.scope.toString() + this.SEPARATOR + scope;
  }

  var originalScope = scope;
  scope = scope.split(this.SEPARATOR);

  if (scope.length > 0 && scope[0] !== "js") {
    scope.unshift("js");
  }

  while (messages && scope.length > 0) {
    currentScope = scope.shift();
    messages = messages[currentScope];
  }

  if (messages === undefined && this.extras && this.extras[locale]) {
    messages = this.extras[locale];
    scope = originalScope.split(this.SEPARATOR);

    while (messages && scope.length > 0) {
      currentScope = scope.shift();
      messages = messages[currentScope];
    }
  }

  if (messages === undefined) {
    messages = options.defaultValue;
  }

  return messages;
};

// Merge serveral hash options, checking if value is set before
// overwriting any value. The precedence is from left to right.
//
//   I18n.prepareOptions({name: "John Doe"}, {name: "Mary Doe", role: "user"});
//   #=> {name: "John Doe", role: "user"}
//
I18n.prepareOptions = function() {
  var options = {},
    opts,
    count = arguments.length;

  for (var i = 0; i < count; i++) {
    opts = arguments[i];

    if (!opts) {
      continue;
    }

    for (var key in opts) {
      if (!this.isValidNode(options, key)) {
        options[key] = opts[key];
      }
    }
  }

  return options;
};

I18n.interpolate = function(message, options) {
  options = this.prepareOptions(options);

  var matches = message.match(this.PLACEHOLDER),
    placeholder,
    value,
    name;

  if (!matches) {
    return message;
  }

  for (var i = 0; (placeholder = matches[i]); i++) {
    name = placeholder.replace(this.PLACEHOLDER, "$1");

    if (typeof options[name] === "string") {
      // The dollar sign (`$`) is a special replace pattern, and `$&` inserts
      // the matched string. Thus dollars signs need to be escaped with the
      // special pattern `$$`, which inserts a single `$`.
      // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace#Specifying_a_string_as_a_parameter
      value = options[name].replace(/\$/g, "$$$$");
    } else {
      value = options[name];
    }

    if (!this.isValidNode(options, name)) {
      value = "[missing " + placeholder + " value]";
    }

    var regex = new RegExp(
      placeholder.replace(/\{/gm, "\\{").replace(/\}/gm, "\\}")
    );
    message = message.replace(regex, value);
  }

  return message;
};

I18n.translate = function(scope, options) {
  options = this.prepareOptions(options);
  options.needsPluralization = typeof options.count === "number";
  options.ignoreMissing = !this.noFallbacks;

  var translation = this.findTranslation(scope, options);

  if (!this.noFallbacks) {
    if (!translation && this.fallbackLocale) {
      options.locale = this.fallbackLocale;
      translation = this.findTranslation(scope, options);
    }

    options.ignoreMissing = false;

    if (!translation && this.currentLocale() !== this.defaultLocale) {
      options.locale = this.defaultLocale;
      translation = this.findTranslation(scope, options);
    }

    if (!translation && this.currentLocale() !== "en") {
      options.locale = "en";
      translation = this.findTranslation(scope, options);
    }
  }

  try {
    return this.interpolate(translation, options);
  } catch (error) {
    return this.missingTranslation(scope);
  }
};

I18n.findTranslation = function(scope, options) {
  var translation = this.lookup(scope, options);

  if (translation && options.needsPluralization) {
    translation = this.pluralize(translation, scope, options);
  }

  return translation;
};

I18n.toNumber = function(number, options) {
  options = this.prepareOptions(options, this.lookup("number.format"), {
    precision: 3,
    separator: this.SEPARATOR,
    delimiter: ",",
    strip_insignificant_zeros: false
  });

  var negative = number < 0,
    string = Math.abs(number)
      .toFixed(options.precision)
      .toString(),
    parts = string.split(this.SEPARATOR),
    precision,
    buffer = [],
    formattedNumber;

  number = parts[0];
  precision = parts[1];

  while (number.length > 0) {
    buffer.unshift(number.substr(Math.max(0, number.length - 3), 3));
    number = number.substr(0, number.length - 3);
  }

  formattedNumber = buffer.join(options.delimiter);

  if (options.precision > 0) {
    formattedNumber += options.separator + parts[1];
  }

  if (negative) {
    formattedNumber = "-" + formattedNumber;
  }

  if (options.strip_insignificant_zeros) {
    var regex = {
      separator: new RegExp(options.separator.replace(/\./, "\\.") + "$"),
      zeros: /0+$/
    };

    formattedNumber = formattedNumber
      .replace(regex.zeros, "")
      .replace(regex.separator, "");
  }

  return formattedNumber;
};

I18n.toHumanSize = function(number, options) {
  var kb = 1024,
    size = number,
    iterations = 0,
    unit,
    precision;

  while (size >= kb && iterations < 4) {
    size = size / kb;
    iterations += 1;
  }

  if (iterations === 0) {
    unit = this.t("number.human.storage_units.units.byte", { count: size });
    precision = 0;
  } else {
    unit = this.t(
      "number.human.storage_units.units." +
        [null, "kb", "mb", "gb", "tb"][iterations]
    );
    precision = size - Math.floor(size) === 0 ? 0 : 1;
  }

  options = this.prepareOptions(options, {
    precision: precision,
    format: "%n%u",
    delimiter: ""
  });

  number = this.toNumber(size, options);
  number = options.format.replace("%u", unit).replace("%n", number);

  return number;
};

I18n.pluralizer = function(locale) {
  var pluralizer = this.pluralizationRules[locale];
  if (pluralizer !== undefined) return pluralizer;
  return this.pluralizationRules["en"];
};

I18n.findAndTranslateValidNode = function(keys, translation) {
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (this.isValidNode(translation, key)) return translation[key];
  }
  return null;
};

I18n.pluralize = function(translation, scope, options) {
  if (typeof translation !== "object") return translation;

  options = this.prepareOptions(options);
  var count = options.count.toString();

  var pluralizer = this.pluralizer(options.locale || this.currentLocale());
  var key = pluralizer(Math.abs(count));
  var keys = typeof key === "object" && key instanceof Array ? key : [key];

  var message = this.findAndTranslateValidNode(keys, translation);

  if (message !== null || options.ignoreMissing) {
    return message;
  }

  return this.missingTranslation(scope, keys[0]);
};

I18n.missingTranslation = function(scope, key) {
  var message = "[" + this.currentLocale() + this.SEPARATOR + scope;
  if (key) {
    message += this.SEPARATOR + key;
  }
  return message + "]";
};

I18n.currentLocale = function() {
  return I18n.locale || I18n.defaultLocale;
};

I18n.enableVerboseLocalization = function() {
  var counter = 0;
  var keys = {};
  var t = I18n.t;

  I18n.noFallbacks = true;

  I18n.t = I18n.translate = function(scope, value) {
    var current = keys[scope];
    if (!current) {
      current = keys[scope] = ++counter;
      var message = "Translation #" + current + ": " + scope;
      if (!_.isEmpty(value)) {
        message += ", parameters: " + JSON.stringify(value);
      }
      // eslint-disable-next-line no-console
      console.info(message);
    }
    return t.apply(I18n, [scope, value]) + " (#" + current + ")";
  };
};

I18n.enableVerboseLocalizationSession = function() {
  sessionStorage.setItem("verbose_localization", "true");
  I18n.enableVerboseLocalization();

  return "Verbose localization is enabled. Close the browser tab to turn it off. Reload the page to see the translation keys.";
};

// shortcuts
I18n.t = I18n.translate;


MessageFormat = {locale: {}};
I18n._compiledMFs = {"logs_error_rate_notice.reached_hour_MF" : function(){ return "Invalid Format: Uncaught SyntaxError: Expected \"=\", \"}\" or [a-zA-Z$_] but \"%u0430\" found. at undefined:1376:10";}, "logs_error_rate_notice.reached_minute_MF" : function(){ return "Invalid Format: Uncaught SyntaxError: Expected \"=\", \"}\" or [a-zA-Z$_] but \"%u0430\" found. at undefined:1376:10";}, "logs_error_rate_notice.exceeded_hour_MF" : function(){ return "Invalid Format: Uncaught SyntaxError: Expected \"=\", \"}\" or [a-zA-Z$_] but \"%u0430\" found. at undefined:1376:10";}, "logs_error_rate_notice.exceeded_minute_MF" : function(){ return "Invalid Format: Uncaught SyntaxError: Expected \"=\", \"}\" or [a-zA-Z$_] but \"%u0430\" found. at undefined:1376:10";}, "topic.read_more_MF" : function(d){
var r = "";
r += "У вас залишилося ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "UNREAD";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"0" : function(d){
var r = "";
return r;
},
"one" : function(d){
var r = "";
r += "<a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/unread'>1 непрочитана</a> ";
return r;
},
"other" : function(d){
var r = "";
r += "<a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/unread'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " непрочитаних</a> ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["uk"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "NEW";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"0" : function(d){
var r = "";
return r;
},
"one" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_2 = "BOTH";
var k_2=d[lastkey_2];
var off_1 = 0;
var pf_1 = { 
"true" : function(d){
var r = "";
r += "и ";
return r;
},
"false" : function(d){
var r = "";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_1[ k_2 ] || pf_1[ "other" ])( d );
r += " <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/new'>1 нова</a> тема";
return r;
},
"other" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_2 = "BOTH";
var k_2=d[lastkey_2];
var off_1 = 0;
var pf_1 = { 
"true" : function(d){
var r = "";
r += "и ";
return r;
},
"false" : function(d){
var r = "";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_1[ k_2 ] || pf_1[ "other" ])( d );
r += " <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/new'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " нових</a> тем";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["uk"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ", або ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "CATEGORY";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"true" : function(d){
var r = "";
r += "подивіться інші теми в розділі ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["catLink"];
return r;
},
"false" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["latestLink"];
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_0[ k_1 ] || pf_0[ "other" ])( d );
return r;
}, "flagging.delete_confirm_MF" : function(d){
var r = "";
r += "Ви збираєтеся видалити ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "POSTS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<b>1</b> повідомлення";
return r;
},
"other" : function(d){
var r = "";
r += "<b>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</b> повідомлень";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["uk"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " та ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "TOPICS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<b>1</b> тему";
return r;
},
"other" : function(d){
var r = "";
r += "<b>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</b> теми";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["uk"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " цього користувача, а також видалити його обліковий запис, додати його IP адресу <b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["ip_address"];
r += "</b> та його поштову адресу <b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["email"];
r += "</b> в чорный список. Ви дійсно впевнені, що ваші помисли чисті та дії не продиктовані гнівом?";
return r;
}, "posts_likes_MF" : function(d){
var r = "";
r += "В цій темі ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "count";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 повідомлення";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " повідомлень";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["uk"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "ratio";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"low" : function(d){
var r = "";
r += "з високим рейтингом симпатій";
return r;
},
"med" : function(d){
var r = "";
r += "з дуже високим рейтингом симпатій";
return r;
},
"high" : function(d){
var r = "";
r += "з надзвичайно високим рейтингом симпатій";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_0[ k_1 ] || pf_0[ "other" ])( d );
r += "\n";
return r;
}, "admin.user.delete_all_posts_confirm_MF" : function(d){
var r = "";
r += "Ви збираєтеся видалити ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "POSTS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 повідомлення";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " повідомлень";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["uk"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " та ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "TOPICS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 тему";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " тем";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["uk"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ". Ви впевнені?";
return r;
}, "too_few_topics_and_posts_notice_MF" : function(d){
var r = "";
r += "让我们<a href=\"https://blog.discourse.org/2014/08/building-a-discourse-community/\">开始讨论吧！</a>现";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "currentTopics";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "仅有<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
},
"other" : function(d){
var r = "";
r += "共有 <strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["uk"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "和";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "currentPosts";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["uk"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。访客需要更多的阅读和回复——我们建议至少 ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "requiredTopics";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["uk"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "和";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "requiredPosts";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["uk"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。此消息仅管理人员可见。";
return r;
}, "too_few_topics_notice_MF" : function(d){
var r = "";
r += "让我们<a href=\"https://blog.discourse.org/2014/08/building-a-discourse-community/\">开始讨论吧！</a>现";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "currentTopics";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "仅有<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
},
"other" : function(d){
var r = "";
r += "共有 <strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["uk"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。访客需要更多的阅读和回复——我们建议至少";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "requiredTopics";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["uk"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。此消息仅管理人员可见。";
return r;
}, "too_few_posts_notice_MF" : function(d){
var r = "";
r += "让我们<a href=\"https://blog.discourse.org/2014/08/building-a-discourse-community/\">开始讨论吧！</a>现 ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "currentPosts";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "仅有<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
},
"other" : function(d){
var r = "";
r += "共有<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["uk"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。访客需要更多的阅读和回复——我们建议至少";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "requiredPosts";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["uk"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。此消息仅管理人员可见。";
return r;
}, "topic.bumped_at_title_MF" : function(){ return "Invalid Format: Uncaught SyntaxError: Expected [a-zA-Z$_] but \"%u9996\" found. at undefined:1376:10";}};
MessageFormat.locale.uk = function (n) {
  if ((n % 10) == 1 && (n % 100) != 11) {
    return 'one';
  }
  if ((n % 10) >= 2 && (n % 10) <= 4 &&
      ((n % 100) < 12 || (n % 100) > 14) && n == Math.floor(n)) {
    return 'few';
  }
  if ((n % 10) === 0 || ((n % 10) >= 5 && (n % 10) <= 9) ||
      ((n % 100) >= 11 && (n % 100) <= 14) && n == Math.floor(n)) {
    // return 'many';
    return 'other'; // TODO should be "many" but is not defined in translations
  }
  return 'other';
};

(function() {

  I18n.messageFormat = function(key, options) {
    var fn = I18n._compiledMFs[key];
    if (fn) {
      try {
        return fn(options);
      } catch(err) {
        return err.message;
      }
    } else {
      return 'Missing Key: ' + key;
    }
    return I18n._compiledMFs[key](options);
  };

})();

I18n.translations = {"uk":{"js":{"number":{"format":{"separator":".","delimiter":","},"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"Байт","few":"Байта","many":"Байт","other":"Байти"},"gb":"ГБ","kb":"КБ","mb":"МБ","tb":"ТБ"}}},"short":{"thousands":"{{number}} тис.","millions":"{{number}} млн."}},"dates":{"time":"HH:mm","time_with_zone":"HH:mm (z)","time_short_day":"ddd, HH:mm","timeline_date":"MMM YYYY","long_no_year_no_time":"D MMM","full_no_year_no_time":"Do MMMM","long_with_year":"D MMM YYYY, HH:mm","long_with_year_no_time":"D MMM, YYYY","full_with_year_no_time":"D MMMM YYYY","long_date_with_year":"D MMM YY, LT","long_date_without_year":"D MMM LT","long_date_with_year_without_time":"D MMM 'YY","long_date_without_year_with_linebreak":"D MMM \u003cbr/\u003eLT","long_date_with_year_with_linebreak":"D MMM 'YY \u003cbr/\u003eLT","wrap_ago":"%{date} тому","tiny":{"half_a_minute":"\u003c 1 хв.","less_than_x_seconds":{"one":"\u003c %{count}с.","few":"\u003c %{count}с.","many":"\u003c %{count}с.","other":"\u003c %{count}с."},"x_seconds":{"one":"%{count}с.","few":"%{count}с.","many":"%{count}с.","other":"%{count}с."},"less_than_x_minutes":{"one":"\u003c %{count}хв.","few":"\u003c %{count}хв.","many":"\u003c %{count}хв.","other":"\u003c %{count}хв."},"x_minutes":{"one":"%{count}хв.","few":"%{count}хв.","many":"%{count}хв.","other":"%{count}хв."},"about_x_hours":{"one":"%{count}год.","few":"%{count}год.","many":"%{count}год.","other":"%{count}год."},"x_days":{"one":"%{count}д.","few":"%{count}д.","many":"%{count}д.","other":"%{count}д."},"x_months":{"one":"%{count}міс.","few":"%{count}міс.","many":"%{count}міс.","other":"%{count}міс."},"about_x_years":{"one":"%{count}р.","few":"%{count}р.","many":"%{count}р.","other":"%{count}р."},"over_x_years":{"one":"\u003e %{count}р.","few":"\u003e %{count}р.","many":"\u003e %{count}р.","other":"\u003e %{count}р."},"almost_x_years":{"one":"%{count}р.","few":"%{count}р.","many":"%{count}р.","other":"%{count}р."},"date_month":"D MMM","date_year":"MMM 'YY"},"medium":{"x_minutes":{"one":"%{count} хвилина","few":"%{count} хвилини","many":"%{count} хвилин","other":"%{count} хвилин"},"x_hours":{"one":"%{count} година","few":"%{count} години","many":"%{count} годин","other":"%{count} годин"},"x_days":{"one":"%{count} день","few":"%{count} дні","many":"%{count} днів","other":"%{count} днів"},"date_year":"D MMM 'YY"},"medium_with_ago":{"x_minutes":{"one":"%{count} хв. тому","few":"%{count} хв. тому","many":"%{count} хв. тому","other":"%{count} хв. тому"},"x_hours":{"one":"%{count} годину тому","few":"%{count} години тому ","many":"%{count} годин тому","other":"%{count} годин тому"},"x_days":{"one":"%{count} день тому","few":"%{count} дні тому","many":"%{count} днів тому","other":"%{count} днів тому"},"x_months":{"one":"%{count} міс. тому","few":"%{count} міс. тому","many":"%{count} міс. тому","other":"%{count} міс. тому"},"x_years":{"one":"%{count} р тому","few":"%{count} р тому","many":"%{count} р тому","other":"%{count} р тому"}},"later":{"x_days":{"one":"%{count} день по тому","few":"%{count} дні по тому","many":"%{count} днів по тому","other":"%{count} днів по тому"},"x_months":{"one":"%{count} місяць по тому","few":"%{count} місяці по тому","many":"%{count} місяців по тому","other":"%{count} місяців по тому"},"x_years":{"one":"%{count} рік по тому","few":"%{count} роки по тому","many":"%{count} років по тому","other":"%{count} років по тому"}},"previous_month":"Попередній місяць","next_month":"Наступний місяць","placeholder":"дата"},"share":{"topic_html":"Тема: \u003cspan class=\"topic-title\"\u003e%{topicTitle}\u003c/span\u003e","post":"допис #%{postNumber}","close":"сховати","twitter":"Поширити це посилання у Twitter","facebook":"Поширити це посилання у Facebook","email":"Надіслати це посилання листом на e-mail"},"action_codes":{"public_topic":"робить цю тему публічною %{when}","private_topic":"робить цю тему особистим повідомленням %{when}","split_topic":"розділив цю тему %{when}","invited_user":"запросив %{who} %{when}","invited_group":"запросив %{who} %{when}","user_left":"%{who} вилучив себе з цього повідомлення %{when}","removed_user":"вилучив %{who} %{when}","removed_group":"вилучив %{who} %{when}","autobumped":"автоматично піднято %{when}","autoclosed":{"enabled":"закрито %{when}","disabled":"відкрито %{when}"},"closed":{"enabled":"закрито %{when}","disabled":"відкрито %{when}"},"archived":{"enabled":"архівовано %{when}","disabled":"розархівовано %{when}"},"pinned":{"enabled":"закріплено %{when}","disabled":"відкріплено %{when}"},"pinned_globally":{"enabled":"закріплено глобально %{when}","disabled":"відкріплено %{when}"},"visible":{"enabled":"додано у список %{when}","disabled":"вилучено зі списку %{when}"},"banner":{"enabled":"робить це банером %{when}. Він з'являтиметься угорі кожної сторінки, поки користувач його не прибере.","disabled":"вилучає цей банер %{when}. Він більше не з'являтиметься угорі кожної сторінки."},"forwarded":"переслано вищевказаний електронний лист"},"topic_admin_menu":"дії теми","wizard_required":"Запрошуємо до вашого нового Discourse! Давайте розпочнемо з \u003ca href='%{url}' data-auto-route='true'\u003eмайстра налаштування\u003c/a\u003e ✨","emails_are_disabled":"Надсилання повідомлень електронною поштою було глобально вимкнено адміністратором. Жодне сповіщення електронною поштою не буде надіслано.","bootstrap_mode_enabled":"Задля спрощення запуску вашого нового сайту, ви зараз у режимі початкового завантаження. Усі нові користувачі отримають рівень довіри 1 й увімкнені щоденні підсумки електронною поштою. Це буде автоматично вимкнено, коли приєднається мінімально потрібна кількість користувачів — %{min_users}.","bootstrap_mode_disabled":"Режим Bootstrap буде вимкнено через 24 години.","themes":{"default_description":"Промовчання","broken_theme_alert":"Ваш сайт може не працювати, тому що оформлення/компонент %{theme} містить помилки. Вимкніть його тут: %{path}."},"s3":{"regions":{"ap_northeast_1":"Азія (Токіо)","ap_northeast_2":"Азія (Сеул)","ap_south_1":"Азія (Мумбай)","ap_southeast_1":"Азія (Сингапур)","ap_southeast_2":"Азія (Сідней)","ca_central_1":"Канада (Центральна)","cn_north_1":"Китай (Пекін)","cn_northwest_1":"Китай (Нінся)","eu_central_1":"ЄС (Франкфурт)","eu_north_1":"ЄС (Стокгольм)","eu_west_1":"ЄС (Ірландія)","eu_west_2":"ЄС (Лондон)","eu_west_3":"ЄС (Париж)","sa_east_1":"Південна Америка (Сан-Паулу)","us_east_1":"Схід США (Пн. Вірджинія)","us_east_2":"Схід США (Огайо)","us_gov_east_1":"AWS GovCloud (схід США)","us_gov_west_1":"AWS GovCloud (захід США)","us_west_1":"Захід США (Пн. Каліфорнія)","us_west_2":"Захід США (Орегон)"}},"edit":"редагувати назву та розділ цієї теми","expand":"Розгорнути","not_implemented":"Цей функціонал ще не реалізовано, даруйте!","no_value":"Ні","yes_value":"Так","submit":"Надіслати","generic_error":"Даруйте, виникла помилка.","generic_error_with_reason":"Виникла помилка: %{error}","go_ahead":"Вперед","sign_up":"Зареєструватись","log_in":"Увійти","age":"Вік","joined":"Приєднався(-лась)","admin_title":"Адмін","show_more":"показати більше","show_help":"налаштування","links":"Посилання","links_lowercase":{"one":"посилання","few":"посилань","many":"посилання","other":"посилання"},"faq":"Часті запитання","guidelines":"Настанови","privacy_policy":"Політика конфіденційності","privacy":"Конфіденційність","tos":"Умови використання","rules":"Правила","conduct":"Кодекс поведінки","mobile_view":"Мобільний вигляд","desktop_view":"Стаціонарний вигляд","you":"Ви","or":"або","now":"щойно","read_more":"читати більше","more":"Більше","less":"Менше","never":"ніколи","every_30_minutes":"кожні 30 хвилин","every_hour":"щогодини","daily":"щодня","weekly":"щотижня","every_month":"щомісяця","every_six_months":"що шість місяців","max_of_count":"не більше {{count}}","alternation":"або","character_count":{"one":"{{count}} символ","few":"{{count}} символи","many":"{{count}} символів","other":"{{count}} символів"},"related_messages":{"title":"Пов'язані повідомлення","see_all":"Переглянути \u003ca href=\"%{path}\"\u003eусі дописи \u003c/a\u003e від @%{username}…"},"suggested_topics":{"title":"Схожі теми","pm_title":"Схожі повідомлення"},"about":{"simple_title":"Інформація","title":"Інформація про %{title}","stats":"Статистика","our_admins":"Наші адміни","our_moderators":"Наші модератори","moderators":"Модератори","stat":{"all_time":"За весь час","last_7_days":"Останні 7","last_30_days":"Останні 30"},"like_count":"Вподобання","topic_count":"Теми","post_count":"Дописи","user_count":"Користувачі","active_user_count":"Активні користувачі","contact":"Контакти","contact_info":"У випадку серйозних проблем з цим сайтом, будь ласка, зв'яжіться з нами через %{contact_info}."},"bookmarked":{"title":"Закладки","clear_bookmarks":"Очистити закладки","help":{"bookmark":"Натисніть, щоб закласти перший допис у цій темі","unbookmark":"Натисніть, щоб видалити усі закладки у цій темі"}},"bookmarks":{"created":"ви додали цей допис до закладок","not_bookmarked":"додати цей допис до закладок","remove":"Вилучити закладку","confirm_clear":"Ви впевнені, що хочете вилучити всі закладки з цієї теми?","save":"Зберегти","no_timezone":"Ви ще не встановили часовий пояс. Ви не зможете встановити нагадування. Налаштуйте його \u003ca href=\"%{basePath}/my/preferences/profile\"\u003eу своєму профілі\u003c/a\u003e .","reminders":{"at_desktop":"Наступного разу на мій робочий стіл","later_today":"Пізніше сьогодні","tomorrow":"Завтра","next_week":"На наступному тижні","later_this_week":"Пізніше на цьому тижні","next_month":"В наступному місяці","custom":"Вибрана дата та час"}},"drafts":{"resume":"Продовжити","remove":"Вилучити","new_topic":"Нова чернетка теми","new_private_message":"Нова чернетка приватного повідомлення","topic_reply":"Чернетка відповіді","abandon":{"confirm":"Ви уже відкрили іншу чернетку у цій темі. Ви впевнені, що хочете покинути її?","yes_value":"Так, відмовитись","no_value":"Ні, зачекайте"}},"topic_count_latest":{"one":"Переглянути {{count}} нову чи оновлену тему","few":"Переглянути {{count}} нові чи оновлені теми","many":"Переглянути {{count}} нових чи оновлених тем","other":"Переглянути {{count}} нових чи оновлених тем"},"topic_count_unread":{"one":"Переглянути {{count}} непрочитану тему","few":"Переглянути {{count}} непрочитані теми","many":"Переглянути {{count}} непрочитаних тем","other":"Переглянути {{count}} непрочитаних тем"},"topic_count_new":{"one":"Переглянути {{count}} нову тему","few":"Переглянути {{count}} нові теми","many":"Переглянути {{count}} нових тем","other":"Переглянути {{count}} нових тем"},"preview":"попередній перегляд","cancel":"скасувати","save":"Зберегти зміни","saving":"Збереження…","saved":"Збережено!","upload":"Завантажити","uploading":"Завантаження…","uploading_filename":"Завантаження: {{filename}}…","clipboard":"буфер обміну","uploaded":"Завантажено!","pasting":"Вставляння…","enable":"Увімкнути","disable":"Вимкнути","continue":"Продовжити","undo":"Скасувати","revert":"Повернути","failed":"Помилка","switch_to_anon":"Увійти в анонімний режим","switch_from_anon":"Полишити анонімний режим","banner":{"close":"Прибрати цей банер.","edit":"Редагувати цей банер \u003e\u003e"},"pwa":{"install_banner":"Чи хочете ви \u003ca href\u003e встановити %{title} на цей пристрій?\u003c/a\u003e"},"choose_topic":{"none_found":"Не знайдено тем.","title":{"search":"Пошук теми","placeholder":"введіть тут назву теми, URL-адресу або ідентифікатор"}},"choose_message":{"none_found":"Не знайдено співпадінь.","title":{"search":"Шукати повідомлення","placeholder":"введіть тут назву, URL-адресу або ідентифікатор"}},"review":{"order_by":"Сортувати за","in_reply_to":"у відповідь на","explain":{"why":"поясніть, чому цей елемент виявився в черзі","title":"Оцінка","formula":"Формула","subtotal":"Проміжний підсумок","total":"Всього","min_score_visibility":"Мінімальна Оцінка для видимості","score_to_hide":"Оцінка, щоб приховати повідомлення","take_action_bonus":{"name":"застосований захід","title":"Коли співробітник вирішує вжити заходів, прапор отримує бонус."},"user_accuracy_bonus":{"name":"точність користувача","title":"Користувачі, чиї прапори були історично узгоджені, отримують бонус."},"trust_level_bonus":{"name":"рівень довіри","title":"Перевіряємі елементи, створені користувачами з більш високим рівнем довіри, мають більш високий бал."},"type_bonus":{"name":"тип бонуса","title":"Деякі перевіряємі типи можуть бути призначені бонус співробітниками, щоб зробити їх більш пріоритетними."}},"claim_help":{"optional":"Ви можете заявити права на цей елемент, щоб інші не могли його переглядати.","required":"Ви повинні заявити права на елементи, перш ніж ви зможете переглядати їх.","claimed_by_you":"Ви заявили права на цей елемент і можете переглядати його.","claimed_by_other":"Цей елемент був переглянутий лише \u003cb\u003e{{username}}\u003c/b\u003e."},"claim":{"title":"заявити права на цю тему"},"unclaim":{"help":"вилучити цю заявку"},"awaiting_approval":"Очікує схвалення","delete":"Вилучити","settings":{"saved":"Збережено","save_changes":"Зберегти зміни","title":"Налаштування","priorities":{"title":"Властивості до перегляду"}},"moderation_history":"Історія модерації","view_all":"Переглянути всі","grouped_by_topic":"Згруповано за темою","none":"Немає елементів для перегляду.","view_pending":"переглянути в очікуванні","topic_has_pending":{"one":"Ця тема має \u003cb\u003e%{count}\u003c/b\u003e допис, що очікує схвалення","few":"Ця тема має \u003cb\u003e{{count}}\u003c/b\u003e дописи, що очікують схвалення","many":"Ця тема має \u003cb\u003e{{count}}\u003c/b\u003e дописів, що очікують схвалення","other":"Ця тема має \u003cb\u003e{{count}}\u003c/b\u003e дописів, що очікують схвалення"},"title":"Переглянути","topic":"Тема:","filtered_topic":"Ви відфільтрували контент до перегляду у одній темі.","filtered_user":"Користувач","show_all_topics":"показати усі теми","deleted_post":"(допис вилучено)","deleted_user":"(користувача вилучено)","user":{"bio":"Біо","website":"Веб-сайт","username":"Ім'я користувача","email":"Електронна пошта","name":"Ім'я","fields":"Поля"},"user_percentage":{"summary":{"one":"{{agreed}}, {{disagreed}}, {{ignored}} (усього {{count}} прапорець)","few":"{{agreed}}, {{disagreed}}, {{ignored}} (усього {{count}} прапорці)","many":"{{agreed}}, {{disagreed}}, {{ignored}} (усього {{count}} прапорців)","other":"{{agreed}}, {{disagreed}}, {{ignored}} (усього {{count}} прапорців)"},"agreed":{"one":"{{count}}% згод","few":"{{count}}% згодні","many":"{{count}}% згодні","other":"{{count}}% згодні"},"disagreed":{"one":"{{count}}% не згодні","few":"{{count}}% не згодні","many":"{{count}}% не згодні","other":"{{count}}% не згодні"},"ignored":{"one":"{{count}}% ігнорують","few":"{{count}}% ігнорують","many":"{{count}}% ігнорують","other":"{{count}}% ігнорують"}},"topics":{"topic":"Тема","reviewable_count":"Кількість","reported_by":"Повідомлень","deleted":"[Тему вилучено]","original":"(оригінальна тема)","details":"деталі","unique_users":{"one":"%{count} користувач","few":"{{count}} користувачі","many":"{{count}} користувачів","other":"{{count}} користувачів"}},"replies":{"one":"%{count} відповідь","few":"{{count}} відповіді","many":"{{count}} відповідей","other":"{{count}} відповідей"},"edit":"Редагувати","save":"Зберегти","cancel":"Скасувати","new_topic":"Схвалення цього елемента створить нову тему","filters":{"all_categories":"(усі категорії)","type":{"title":"Тип","all":"(усі типи)"},"minimum_score":"Мінімальний бал:","refresh":"Оновити","status":"Статус","category":"Категорія","orders":{"priority":"Пріоритет","priority_asc":"Пріоритет (зворотний порядок)","created_at":"Створено в","created_at_asc":"Створено (зворотний порядок)"},"priority":{"title":"Мінімальний пріоритет","low":"(будь-який)","medium":"Середній","high":"Високий"}},"conversation":{"view_full":"переглянути усю розмову"},"scores":{"about":"Цей бал розраховується на основі рівня довіри доповідача, відповідності їхніх попередніх скарг та пріоритету елемента, про який було сповіщено.","score":"Бал","date":"Дата","type":"Тип","status":"Статус","submitted_by":"Подано","reviewed_by":"Переглянуто"},"statuses":{"pending":{"title":"Очікують"},"approved":{"title":"Схвалено"},"rejected":{"title":"Відхилено"},"ignored":{"title":"Проігноровано"},"deleted":{"title":"Вилучено"},"reviewed":{"title":"(усі переглянуті)"},"all":{"title":"(усе)"}},"types":{"reviewable_flagged_post":{"title":"Позначений допис","flagged_by":"Позначено"},"reviewable_queued_topic":{"title":"Тема в черзі"},"reviewable_queued_post":{"title":"Допис у черзі"},"reviewable_user":{"title":"Користувач"}},"approval":{"title":"Допис потребує схвалення","description":"Ми отримали ваш новий допис, але він потребує схвалення модератором, перш ніж з'явиться. Будь ласка, будьте терплячі.","pending_posts":{"one":"У вас \u003cstrong\u003e%{count}\u003c/strong\u003e допис очікує схвалення.","few":"У вас \u003cstrong\u003e{{count}}\u003c/strong\u003e дописи очікують схвалення.","many":"У вас \u003cstrong\u003e{{count}}\u003c/strong\u003e дописів очікують схвалення.","other":"У вас \u003cstrong\u003e{{count}}\u003c/strong\u003e дописів очікують схвалення."},"ok":"Гаразд"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e створив(ла) \u003ca href='{{topicUrl}}'\u003eтему\u003c/a\u003e","you_posted_topic":"\u003ca href='{{userUrl}}'\u003eВи\u003c/a\u003e створили \u003ca href='{{topicUrl}}'\u003eтему\u003c/a\u003e","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e відповів(ла) на \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003eВи\u003c/a\u003e відповіли на \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e відповів(ла) на \u003ca href='{{topicUrl}}'\u003eтему\u003c/a\u003e","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003eВи\u003c/a\u003e відповіли на \u003ca href='{{topicUrl}}'\u003eтему\u003c/a\u003e","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e згадав(ла) \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e згадав(ла) \u003ca href='{{user2Url}}'\u003eВас\u003c/a\u003e","you_mentioned_user":"\u003ca href='{{user1Url}}'\u003eВи\u003c/a\u003e згадали \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","posted_by_user":"Написано користувачем \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","posted_by_you":"Написано \u003ca href='{{userUrl}}'\u003eВами\u003c/a\u003e","sent_by_user":"Надіслано користувачем \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","sent_by_you":"Надіслано \u003ca href='{{userUrl}}'\u003eВами\u003c/a\u003e"},"directory":{"filter_name":"фільтрувати за іменем користувача","title":"Користувачі","likes_given":"Відправлено","likes_received":"Отримано","topics_entered":"Переглянуто","topics_entered_long":"Тем переглянуто","time_read":"Час читання","topic_count":"Теми","topic_count_long":"Тем створено","post_count":"Відповідей","post_count_long":"Відповідей опубліковано","no_results":"Нічого не знайдено.","days_visited":"Відвідин","days_visited_long":"Днів відвідин","posts_read":"Прочитані","posts_read_long":"Повідомлень прочитано","total_rows":{"one":"%{count} користувач","few":"%{count} користувачі","many":"%{count} користувачів","other":"%{count} користувачів"}},"group_histories":{"actions":{"change_group_setting":"Змінити налаштування групи","add_user_to_group":"Додати користувача","remove_user_from_group":"Вилучити користувача","make_user_group_owner":"Зробити власником","remove_user_as_group_owner":"Відкликати власника"}},"groups":{"member_added":"Додано","member_requested":"Запит подано","add_members":{"title":"Додати учасників","description":"Керувати членством цієї групи","usernames":"Імена користувачів"},"requests":{"title":"Запити","reason":"Причина","accept":"Схвалити","accepted":"схвалено","deny":"Відмовити","denied":"відмовлено","undone":"запит скасовано","handle":"обробляти запит на вступ"},"manage":{"title":"Керувати","name":"Ім'я","full_name":"Повне ім'я","add_members":"Додати учасників","delete_member_confirm":"Вилучити '%{username}' з групи '%{group}'?","profile":{"title":"Профіль"},"interaction":{"title":"Взаємодія","posting":"Дописів","notification":"Сповіщення"},"membership":{"title":"Членство","access":"Доступ"},"logs":{"title":"Журнали","when":"Коли","action":"Дія","acting_user":"Ініціатор","target_user":"Цільовий користувач","subject":"Тема","details":"Деталі","from":"Від","to":"До"}},"public_admission":"Дозволити користувачам вільно приєднуватися до групи (потрібна публічна видимість групи)","public_exit":"Дозволити користувачам вільно покидати групу","empty":{"posts":"Немає дописів від членів цієї групи.","members":"Немає учасників у цій групі.","requests":"Немає запитів на членство у цій групі.","mentions":"Немає згадок про цю групу.","messages":"Немає повідомлень для цієї групи.","topics":"Немає тем від учасників цієї групи.","logs":"Немає журналів у цій групі."},"add":"Додати","join":"Приєднатися","leave":"Покинути","request":"Запит","message":"Повідомлення","confirm_leave":"Ви впевнені, що хочете залишити цю групу?","allow_membership_requests":"Дозволити користувачам надсилати запити на членство власникам групи (Потрібна загальнодоступна група)","membership_request_template":"Власний шаблон для відображення користувачам при надсиланні запиту на членство","membership_request":{"submit":"Подати запит","title":"Запит на приєднання до @%{group_name}","reason":"Поясніть власникам групи, чому ви маєте бути у цій групі"},"membership":"Членство","name":"Ім'я","group_name":"Назва групи","user_count":"Користувачі","bio":"Про групу","selector_placeholder":"введіть ім'я користувача","owner":"власник","index":{"title":"Групи","all":"Усі групи","empty":"Немає видимих груп.","filter":"Фільтрувати за типом групи","owner_groups":"Групи, де я власник(ця)","close_groups":"Закриті групи","automatic_groups":"Автоматичні групи","automatic":"Автоматичні","closed":"Закриті","public":"Публічні","private":"Приватні","public_groups":"Публічні групи","automatic_group":"Автоматична група","close_group":"Закрита група","my_groups":"Мої групи","group_type":"Тип групи","is_group_user":"Учасник","is_group_owner":"Власник"},"title":{"one":"Група","few":"Групи","many":"Групи","other":"Групи"},"activity":"Активність","members":{"title":"Учасники","filter_placeholder_admin":"ім'я користувача або email","filter_placeholder":"ім'я користувача","remove_member":"Вилучити учасника","remove_member_description":"Вилучити \u003cb\u003e%{username}\u003c/b\u003e з цієї групи","make_owner":"Зробити власником","make_owner_description":"Зробити \u003cb\u003e%{username}\u003c/b\u003e власником цієї групи","remove_owner":"Вилучити як власника","remove_owner_description":"Вилучити \u003cb\u003e%{username}\u003c/b\u003e з власників цієї групи","owner":"Власник","forbidden":"Ви не можете переглядати учасників."},"topics":"Теми","posts":"Дописи","mentions":"Згадки","messages":"Повідомлення","notification_level":"Рівень сповіщень для групових повідомлень за замовчуванням","alias_levels":{"mentionable":"Хто може @згадувати цю групу?","messageable":"Хто може писати повідомлення цій групі?","nobody":"Ніхто","only_admins":"Лише адміністратори","mods_and_admins":"Лише модератори та адміністратори","members_mods_and_admins":"Лише учасники групи, модератори та адміністратори","owners_mods_and_admins":"Лише власники групи, модератори та адміни","everyone":"Усі"},"notifications":{"watching":{"title":"Слідкувати","description":"Ви буде сповіщені про кожен новий допис у кожному повідомленні, і показуватиметься кількість нових відповідей."},"watching_first_post":{"title":"Слідкувати за першим дописом","description":"Ви будете сповіщені про нові повідомлені у цій групі, але не відповіді на повідомлення."},"tracking":{"title":"Стежити","description":"Ви будете сповіщені, якщо хтось згадує ваше @ім'я або відповідає вам, і показуватиметься кількість нових відповідей."},"regular":{"title":"Нормальний","description":"Ви будете сповіщені, якщо хтось згадує ваше @ім'я чи відповідає вам."},"muted":{"title":"Ігнорувати","description":"Ви не будете сповіщені ні про що, що стосується повідомлень у цій групі."}},"flair_url":"Зображення Avatar Flair","flair_url_placeholder":"(Необов'язково) Посилання зображення або клас Font Awesome","flair_url_description":"Використовуйте квадратні іконки не менші за 20px на 20px або інконки FontAwesome (прийнятні формати: \"fa-icon\", \"far fa-icon\" або \"fab fa-icon\").","flair_bg_color":"Колір тла Avatar Flair","flair_bg_color_placeholder":"(Необов'язково) Значення кольору в Hex-код","flair_color":"Колір Avatar Flair","flair_color_placeholder":"(Необов'язково) Значення кольору в Hex-код","flair_preview_icon":"Іконка Попередній перегляд","flair_preview_image":"Попередній перегляд зображення"},"user_action_groups":{"1":"Вподобані","2":"Отримані вподобання","3":"Закладки","4":"Теми","5":"Відповіді","6":"Відповіді","7":"Згадки","9":"Цитати","11":"Редагування","12":"Надіслані","13":"Вхідні","14":"Очікують","15":"Чернетки"},"categories":{"all":"усі розділи","all_subcategories":"усі","no_subcategory":"немає","category":"Розділ","category_list":"Показати список розділів","reorder":{"title":"Перевпорядкувати розділів","title_long":"Перевпорядкувати список розділів","save":"Зберегти порядок","apply_all":"Застосувати","position":"Позиція"},"posts":"Повідомлення","topics":"Теми","latest":"Останні","latest_by":"Останні від","toggle_ordering":"показати/сховати елемент керування для впорядкування","subcategories":"Підкатегорії","topic_sentence":{"one":"%{count} тема","few":"%{count} теми","many":"%{count} тем","other":"%{count} теми"},"topic_stat_sentence_week":{"one":"%{count} нова тема за минулий тиждень.","few":"%{count} нові теми за минулий тиждень.","many":"%{count} нових тем за минулий тиждень.","other":"%{count} нових тем за минулий тиждень."},"topic_stat_sentence_month":{"one":"%{count} нова тема за минулий місяць.","few":"%{count} нові теми за минулий місяць.","many":"%{count} нових тем за минулий місяць.","other":"%{count} нових тем за минулий місяць."},"n_more":"Категорії (ще %{count})…"},"ip_lookup":{"title":"Пошук IP адреси","hostname":"Ім'я хоста","location":"Місцезнаходження","location_not_found":"(невідомо)","organisation":"Організація","phone":"Телефон","other_accounts":"Інші облікові записи з цією IP адресою","delete_other_accounts":"Видалити %{count}","username":"Ім'я користувача","trust_level":"РД","read_time":"час читання","topics_entered":"створено тем","post_count":"дописів","confirm_delete_other_accounts":"Ви впевнені, що хочете видалити цих користувачів?","powered_by":"використовується \u003ca href='https://maxmind.com'\u003eMaxMindDB\u003c/a\u003e","copied":"скопійовано"},"user_fields":{"none":"(вибрати опцію)"},"user":{"said":"{{username}}:","profile":"Профіль","mute":"Знемовити","edit":"Редагувати налаштування","download_archive":{"button_text":"Завантажити все","confirm":"Ви впевнені, що хочете завантажити свої дописи?","success":"Завантаження розпочато, ви отримаєте повідомлення, коли процес завершиться.","rate_limit_error":"Дописи можна завантажити раз на день, будь ласка, спробуйте завтра."},"new_private_message":"Нове повідомлення","private_message":"Повідомлення","private_messages":"Повідомлення","user_notifications":{"ignore_duration_title":"Ігнорувати таймер","ignore_duration_username":"Ім'я користувача","ignore_duration_when":"Тривалість:","ignore_duration_save":"Ігнорувати","ignore_duration_note":"Будь ласка, зверніть увагу, що всі ігнори автоматично зникають, коли закінчується час ігнорування.","ignore_duration_time_frame_required":"Будь ласка, виберіть період часу","ignore_no_users":"У вас немає ігнорованих користувачів.","ignore_option":"Ігноровано","ignore_option_title":"Ви не отримуватимете сповіщення, пов'язані з цим користувачем, а всі їхні теми та відповіді буде приховано.","add_ignored_user":"Додати…","mute_option":"Знемовлено","mute_option_title":"Ви не отримуватимете жодних сповіщень, пов'язаних з цим користувачем.","normal_option":"Нормальний","normal_option_title":"Ви отримаєте сповіщення, коли цей користувач відповість вам, цитуватиме або згадуватиме вас."},"activity_stream":"Активність","preferences":"Налаштування","feature_topic_on_profile":{"open_search":"Виберіть нову тему","title":"Виберіть тему","search_label":"Шукайте тему за назвою","save":"Зберегти","clear":{"title":"Очистити","warning":"Ви впевнені, що хочете очистити свої закріплені теми?"}},"profile_hidden":"Публічний профіль цього користувача прихований.","expand_profile":"Розгорнути","collapse_profile":"Згорнути","bookmarks":"Закладки","bio":"Про мене","timezone":"Часовий пояс","invited_by":"Запрошений(а)","trust_level":"Рівень довіри","notifications":"Сповіщення","statistics":"Статистика","desktop_notifications":{"label":"Сповіщення наживо","not_supported":"Сповіщення не підтримуються у цьому браузері. Даруйте.","perm_default":"Ввімкнути сповіщення","perm_denied_btn":"Немає доступу","perm_denied_expl":"Ви заборонили сповіщення. Дозвольте сповіщення у налаштуваннях свого браузера.","disable":"Вимкнути сповіщення","enable":"Увімкнути сповіщення","each_browser_note":"Зверніть увагу: Вам треба змінити це налаштування у кожному браузері, який ви використовуєте.","consent_prompt":"Чи хочете отримувати сповіщення наживо, коли люди відповідають на ваші дописи?"},"dismiss":"Відкинути","dismiss_notifications":"Відкинути все","dismiss_notifications_tooltip":"Позначити всі сповіщення як прочитані","first_notification":"Ваше перше сповіщення! Оберіть його, щоб почати.","dynamic_favicon":"Показувати кількість на іконці браузера","theme_default_on_all_devices":"Зробити цю тему базовою для усіх моїх пристроїв","text_size_default_on_all_devices":"Зробити цей розмір тексту базовим для всіх моїх пристроїв","allow_private_messages":"Дозволити іншим користувачам надсилати мені особисті повідомлення","external_links_in_new_tab":"Відкривати всі зовнішні посилання у новій вкладці","enable_quoting":"Увімкнути відповіді на цитати для виділеного тексту","enable_defer":"Увімкнути відкладання позначення тем непрочитаними","change":"змінити","featured_topic":"Закріплені теми","moderator":"{{user}} є модератором","admin":"{{user}} є адміном","moderator_tooltip":"Цей користувач є модератором","admin_tooltip":"Цей користувач є адміністратором","silenced_tooltip":"Цей користувач відключений","suspended_notice":"Цього користувача призупинено до {{date}}.","suspended_permanently":"Цей користувач призупинений.","suspended_reason":"Причина: ","github_profile":"Github","email_activity_summary":"Зведення активності","mailing_list_mode":{"label":"Режим списку розсилки","enabled":"Увімкнути режим списку розсилки","instructions":"Це налаштування перекриває зведення активності.\u003cbr /\u003e\nЗнемовлені теми і категорії не включаються у ці листи.\n","individual":"Надсилати всі нові дописи мені електронною поштою","individual_no_echo":"Надсилати всі нові дописи електронною поштою, окрім моїх власних","many_per_day":"Надсилати всі нові дописи електронною поштою (близько {{dailyEmailEstimate}} на день)","few_per_day":"Надсилати всі нові дописи електронною поштою (близько 2 на день)","warning":"Режим списку розсилки увімкнено. Налаштування сповіщень електронною поштою перекрито."},"tag_settings":"Теги","watched_tags":"Спостереження","watched_tags_instructions":"Ви автоматично слідкуватимете за всіма темами з цими мітками. Ви отримуватимете сповіщення про всі нові дописи і теми, а поруч з темою показуватиметься кількість нових дописів.","tracked_tags":"Відстежувані","tracked_tags_instructions":"Ви будете автоматично стежити за всіма темами з цими мітками. Поруч з темою показуватиметься кількість нових дописів.","muted_tags":"Вимкнено","muted_tags_instructions":"Ви не отримуватимете сповіщення ні про що у нових темах з цими мітками, і вони не показуватимуться у найсвіжіших.","watched_categories":"Спостереження","watched_categories_instructions":"Ви автоматично слідкуватимете за всіма темами у цих категоріях. Ви отримуватимете сповіщення про всі нові дописи і теми, а поруч з темою показуватиметься кількість нових дописів.","tracked_categories":"Відстежувані","tracked_categories_instructions":"Ви будете автоматично стежити за всіма темами у цих категоріях. Поруч з темою показуватиметься кількість нових дописів.","watched_first_post_categories":"Слідкувати за першим дописом","watched_first_post_categories_instructions":"Ви отримуватимете сповіщення про перший допис у кожній новій темі у цих категоріях.","watched_first_post_tags":"Слідкувати за першим дописом","watched_first_post_tags_instructions":"Ви отримуватимете сповіщення про перший допис у кожній новій темі з цими мітками.","muted_categories":"Вимкнено","muted_categories_instructions":"Ви не будете отримувати жодних сповіщень про нові теми у цих категоріях, і вони не з'являтимуться на сторінках категорій чи найсвіжіших.","muted_categories_instructions_dont_hide":"Ви не будете сповіщені ні про що, що стосується нових тем у цих категоріях.","no_category_access":"Як модератор, ви маєте обмежений доступ до категорій, збереження вимкнене.","delete_account":"Вилучити мій обліковий запис","delete_account_confirm":"Ви впевнені, що бажаєте остаточно вилучити свій обліковий запис? Цю дію не можна скасувати!","deleted_yourself":"Ваш обліковий запис було успішно вилучено.","delete_yourself_not_allowed":"Якщо ви хочете вилучити свій обліковий запис, будь ласка, зв'яжіться з працівником.","unread_message_count":"Повідомлення","admin_delete":"Вилучити","users":"Користувачі","muted_users":"Вимкнені","muted_users_instructions":"Приховати усі сповіщення від цих користувачів.","ignored_users":"Ігноровано","ignored_users_instructions":"Приховати усі дописи та сповіщення від цих користувачів.","tracked_topics_link":"Показати","automatically_unpin_topics":"Автоматично відкріпляти теми, коли я доходжу до кінця.","apps":"Програми","revoke_access":"Анулювати доступ","undo_revoke_access":"Скасувати анулювання доступу","api_approved":"Схвалено:","api_last_used_at":"Минуле використання:","theme":"Стиль","home":"Базова домашня сторінка","staged":"Поетапний","staff_counters":{"flags_given":"корисні позначки","flagged_posts":"позначені дописи","deleted_posts":"вилучені повідомлення","suspensions":"тимчасові припинення","warnings_received":"попередження"},"messages":{"all":"Усі","inbox":"Вхідні","sent":"Надіслано","archive":"Архів","groups":"Мої групи","bulk_select":"Вибрати повідомлення","move_to_inbox":"Перемістити у Вхідні","move_to_archive":"Архівувати","failed_to_move":"Не вдалося перемістити обрані повідомлення (можливо, у вас мережа зникла)","select_all":"Обрати все","tags":"Теги"},"preferences_nav":{"account":"Обліковий запис","profile":"Профіль","emails":"Листи","notifications":"Сповіщення","categories":"Категорії","users":"Користувачі","tags":"Мітки","interface":"Інтерфейс","apps":"Програми"},"change_password":{"success":"(лист надіслано)","in_progress":"(надсилання листа)","error":"(помилка)","action":"Надіслати лист для відновлення паролю","set_password":"Встановити пароль","choose_new":"Вибрати новий пароль","choose":"Вибрати пароль"},"second_factor_backup":{"title":"Двофакторні резервні коди","regenerate":"Перегенерувати","disable":"Вимкнути","enable":"Увімкнути","enable_long":"Увімкнути резервні коди","manage":"Керувати резервними кодами. У вас залишилося резервних кодів: \u003cstrong\u003e{{count}}\u003c/strong\u003e.","copied_to_clipboard":"Скопійовано у буфер обміну","copy_to_clipboard_error":"Помилка під час копіювання даних у буфер обміну","remaining_codes":"У вас залишилося резервних кодів: \u003cstrong\u003e{{count}}\u003c/strong\u003e.","use":"Використовуйте резервний код","enable_prerequisites":"Ви повинні увімкнути основний другий фактор, перш ніж генерувати резервні коди.","codes":{"title":"Резервні коди згенеровано","description":"Кожен з цих резервних кодів може бути використаний лише раз. Зберігайте їх у безпечному, але доступному місці."}},"second_factor":{"title":"Двофакторна автентифікація","enable":"Керувати двофакторною автентифікацією","forgot_password":"Забули пароль?","confirm_password_description":"Будь ласка, підтвердіть свій пароль для продовження","name":"Ім'я","label":"Код","rate_limit":"Будь ласка, зачекайте, перш ніж спробувати наступний код автентифікації.","enable_description":"Відскануйте цей QR-код у підтримуваній програмі (\u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+android\" target=\"_blank\"\u003eAndroid\u003c/a\u003e – \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+ios\" target=\"_blank\"\u003eiOS\u003c/a\u003e) і введіть свій код автентифікації.\n","disable_description":"Будь ласка, введіть код автентифікації з вашої програми","show_key_description":"Уведіть вручну","short_description":"Захистіть свій обліковий запис одноразовими кодами безпеки.\n","extended_description":"Двофакторна автентифікація краще захищає ваш обліковий запис, вимагаючи окрім вашого пароля ще й введення одноразового токена. Токени можна генерувати на пристроях з \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+android\" target='_blank'\u003eAndroid\u003c/a\u003e та \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+ios\"\u003eiOS\u003c/a\u003e.\n","oauth_enabled_warning":"Будь ласка, зверніть увагу, що вхід через соціальні мережі буде вимкнено, як тільки у вашому обліковому записі буде увімкнена двофакторна автентифікація.","use":"Використовуйте додаток для перевірки автентифікації ","enforced_notice":"Ви мусите увімкнути двофакторну автентифікацію, щоб отримати доступ до цього сайту.","disable":"вимкнути","disable_title":"Вимкнути другий фактор","disable_confirm":"Ви впевнені, що бажаєте вимкнути усі другі фактори?","edit":"Редагувати","edit_title":"Редагувати другий фактор","edit_description":"Назва другого фактора","enable_security_key_description":"Коли ви підготуєте свій фізичний ключ безпеки, натисніть кнопку Реєстрація нижче.","totp":{"title":"Автентифікатори на токенах","add":"Новий автентифікатор","default_name":"Мій автентифікатор"},"security_key":{"register":"Зареєструватися","title":"Ключі безпеки","add":"Зареєструвати ключ безпеки","default_name":"Головний Ключ Безпеки","not_allowed_error":"Час реєстрації ключа безпеки минув, або він був скасований.","already_added_error":"Ви вже зареєстрували цей ключ безпеки. Вам не потрібно реєструвати його знову.","edit":"Змінити Ключ Безпеки","edit_description":"Назва Ключа Безпеки","delete":"Вилучити"}},"change_about":{"title":"Змінити інформацію про мене","error":"Сталася помилка під час цієї зміни."},"change_username":{"title":"Змінити ім'я користувача","confirm":"Ви цілковито впевнені, що бажаєте змінити своє ім'я користувача?","taken":"Даруйте, це ім'я користувача вже зайняте.","invalid":"Таке ім'я користувача не підійде. Воно має містити лише цифри та літери"},"change_email":{"title":"Змінити адресу електронної пошти","taken":"Даруйте, ця адреса не доступна.","error":"При зміні адреси електронної пошти сталася помилка. Можливо, ця адреса вже використовується?","success":"Ми надіслали листа на цю скриньку. Будь ласка, виконайте інструкції щодо підтвердження.","success_staff":"Ми надіслали листа на вашу поточну скриньку. Будь ласка, виконайте інструкції щодо підтвердження."},"change_avatar":{"title":"Змінити своє зображення профілю","letter_based":"Ваше зображення додане автоматично","uploaded_avatar":"Інше зображення","uploaded_avatar_empty":"Додати інше зображення","upload_title":"Завантажити своє зображення","image_is_not_a_square":"Увага: ми обрізали ваше зображення; ширина і висота були неоднакові."},"change_profile_background":{"title":"Заголовок профілю","instructions":"Заголовки профілю будуть по центру та матимуть за замовчуванням ширину 1110 пікселів."},"change_card_background":{"title":"Тло вашої візитки","instructions":"Зображення тла будуть відцентровані, ширина за замовчуванням — 590 пікселів."},"change_featured_topic":{"title":"Закріплені теми","instructions":"Посилання на цю тему буде на вашій картці користувача та в профілі."},"email":{"title":"Електронна пошта","primary":"Основна електронна пошта","secondary":"Другорядна електронна пошта","no_secondary":"Немає другорядних електронних скриньок","sso_override_instructions":"Електронну пошту можна оновити через SSO-провайдера.","instructions":"Ніколи не показується публічно.","ok":"Ми надішлемо Вам листа для підтвердження","invalid":"Будь ласка, введіть вірний email","authenticated":"Вашу адресу електронної пошти підтверджено {{provider}}","frequency_immediately":"Отримувати повідомлення про нові непрочитані повідомлення негайно.","frequency":{"one":"Ми відправимо вам лист тільки в тому випадку, якщо ви більше {{count}} хвилини перебуваєте оффлайн.","few":"Ми відправимо вам лист тільки в тому випадку, якщо ви не були онлайн останні {{count}} хвилин.","many":"Ми відправимо вам лист тільки в тому випадку, якщо ви не були онлайн останні {{count}} хвилин.","other":"Ми відправимо вам лист тільки в тому випадку, якщо ви не були онлайн останні {{count}} xвилин мaкcимyм,."}},"associated_accounts":{"title":"Пов’язані Облікові Записи","connect":"Підключити","revoke":"Анулювати","cancel":"Скасувати","not_connected":"(не пов’язаний)","confirm_modal_title":"Підключити %{provider} Аккаунт","confirm_description":{"account_specific":"Ваш %{provider} аккаунт '%{account_description}' буде використовуватися для аутентифікації.","generic":"Ваш %{provider} обліковий запис буде використовуватися для аутентифікації."}},"name":{"title":"Ім'я","instructions":"ваше повне ім’я (опціонально)","instructions_required":"Ваше повне ім’я","too_short":"Ваше ім’я надто коротке","ok":"Ваше ім’я виглядає добре"},"username":{"title":"Ім'я користувача","instructions":"Унікальний, без пробілів і коротший","short_instructions":"Користувачі можуть згадувати вас за псевдонімом @{{username}}","available":"Ваше ім'я доступне","not_available":"Не доступно. Спробуєте {{suggestion}}?","not_available_no_suggestion":"Не доступно","too_short":"Ваше ім'я закоротке","too_long":"Ваше ім'я довге","checking":"Перевірка доступності імені користувача...","prefilled":"Адреса електронної пошти збігається із зареєстрованим псевдонімом"},"locale":{"title":"Мова інтерфейсу","instructions":"Мова сайту. Необхідно перезавантажити сторінку, щоб зміни вступили в силу.","default":"(за замовчуванням)","any":"будь-який"},"password_confirmation":{"title":"Пароль ще раз"},"auth_tokens":{"title":"Нещодавно використані пристрої","ip":"IP","details":"Деталі","log_out_all":"Вийти з усіх пристроїв","active":"активні зараз","not_you":"Не ви?","show_all":"Показати всі ({{count}})","show_few":"Показати менше","was_this_you":"Це були ви?","was_this_you_description":"Якщо це були не ви, рекомендуємо змінити пароль і вийти з усіх пристроїв.","browser_and_device":"{{browser}} на {{device}}","secure_account":"Захист мого профілю","latest_post":"Ваша остання активність..."},"last_posted":"Останній допис","last_emailed":"Останній електронний лист","last_seen":"Помічено востаннє","created":"Приєднався(лась)","log_out":"Вийти","location":"Місцезнаходження","website":"Вебсайт","email_settings":"Електронна пошта","hide_profile_and_presence":"Приховати мій загальнодоступний профіль і присутність","enable_physical_keyboard":"Включити підтримку фізичної клавіатури на iPad","text_size":{"title":"Розмір тексту","smaller":"Маленький","normal":"Нормальний","larger":"Великий","largest":"Найбільший"},"title_count_mode":{"title":"У заголовку фонової сторінки відображається кількість:","notifications":"Нове повідомлення","contextual":"Зміст нової сторінки"},"like_notification_frequency":{"title":"Повідомляти при отриманні симпатії","always":"Завжди","first_time_and_daily":"Для першої симпатії, і далі не частіше разу на день","first_time":"Тільки для першої симпатії","never":"Ніколи"},"email_previous_replies":{"title":"Додати попередні відповіді до кінця електронних листів","unless_emailed":"якщо раніше не відправляли","always":"завжди","never":"ніколи"},"email_digests":{"title":"У разі моєї відсутності на форумі, надсилайте мені зведення популярних новин","every_30_minutes":"кожні 30 хвилин","every_hour":"щогодини","daily":"щодня","weekly":"щотижня","every_month":"щомісяця","every_six_months":"що шість місяців"},"email_level":{"title":"Надсилати поштове повідомлення, коли хтось цитує мене, відповідає на мій пост, згадує мій @псевдонім або запрошує мене в тему","always":"завжди","only_when_away":"тільки коли вдалині","never":"ніколи"},"email_messages_level":"Надсилати поштове повідомлення, коли хтось залишає мені повідомлення","include_tl0_in_digests":"Включити контент від нових користувачів в зведення, що відправляються по електронній пошті","email_in_reply_to":"Додати попередні відповіді до кінця електронних листів","other_settings":"Інше","categories_settings":"Категорії","new_topic_duration":{"label":"Вважати теми новими, якщо","not_viewed":"я їх ще не переглянув","last_here":"створені після вашого останнього візиту","after_1_day":"створені за минулий день","after_2_days":"створені за останні 2 дні","after_1_week":"створені за останній тиждень","after_2_weeks":"створені за останні 2 тижні"},"auto_track_topics":"Автоматично слідкувати за темами, що я відвідав","auto_track_options":{"never":"ніколи","immediately":"негайно","after_30_seconds":"після 30 секунд","after_1_minute":"після 1 хвилини","after_2_minutes":"після 2 хвилин","after_3_minutes":"після 3 хвилин","after_4_minutes":"після 4 хвилин","after_5_minutes":"після 5 хвилин","after_10_minutes":"після 10 хвилин"},"notification_level_when_replying":"Коли я пишу в темі, встановити цю тему для","invited":{"search":"шукати запрошення...","title":"Запрошення","user":"Запрошений користувач","sent":"Останній відправлений","none":"Немає запрошень для відображення.","truncated":{"one":"перше запрошення","few":"Перші {{count}} запрошення","many":"Перші {{count}} запрошень","other":"Перші {{count}} запрошень"},"redeemed":"Прийняті запрошення","redeemed_tab":"Прийнято","redeemed_tab_with_count":"Прийняті ({{count}})","redeemed_at":"Прийнято","pending":"Запрошення, що очікують","pending_tab":"Очікують","pending_tab_with_count":"Очікують ({{count}})","topics_entered":"Тем переглянуто","posts_read_count":"Прочитано дописів","expired":"Термін дії цього запрошення сплив.","rescind":"Видалити","rescinded":"Запрошення видалено","rescind_all":"Видалити всі прострочені запрошення","rescinded_all":"Всі прострочені запрошення видалені!","rescind_all_confirm":"Ви впевнені, що хочете видалити всі прострочені запрошення?","reinvite":"повторити запрошення","reinvite_all":"Повторити всі запрошення","reinvite_all_confirm":"Ви дійсно хочете відправити всі запрошення повторно?","reinvited":"Запрошення надіслано повторно","reinvited_all":"Всі запрошення вислані повторно!","time_read":"Час читання","days_visited":"Днів відвідано","account_age_days":"Вік облікового запису в днях","create":"Надіслати Запрошення","generate_link":"Копіювати посилання для запрошень","link_generated":"Запрошувальна посилання успішно створена!","valid_for":"Запрошувальне посилання дійсне тільки для цієї адреси електропошти:%{email}","bulk_invite":{"none":"Ви ще нікого не запрошували сюди. Надішліть індивідуальні запрошення або запросіть кілька людей за раз, \u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003eзавантаживши файл CSV\u003c/a\u003e.","text":"Масове Запрошення з Файлу","success":"Файл успішно завантажений, ви отримаєте повідомлення, коли процес буде завершений.","error":"Вибачте, але файл повинен бути у форматі CSV.","confirmation_message":"Ви збираєтеся відправити запрошення електронною поштою всім в завантаженому файлі."}},"password":{"title":"Пароль","too_short":"Ваш пароль надто короткий.","common":"Цей пароль надто простий.","same_as_username":"Ваш пароль ідентичний імені користувача","same_as_email":"Ваш пароль ідентичний Вашому email","ok":"Ваш пароль добрий.","instructions":"не менше %{count} символів"},"summary":{"title":"Підсумок","stats":"Статистика","time_read":"час читання","recent_time_read":"недавній час читання","topic_count":{"one":"тему створив","few":"теми створив","many":"тем створив","other":"тем створив"},"post_count":{"one":"повідомлення написав","few":"повідомлення написав","many":"повідомлень написав","other":"повідомлень написав"},"likes_given":{"one":"даний","few":"даних","many":"даних","other":"дані"},"likes_received":{"one":"отримано","few":"отримано","many":"отримано","other":"отримано"},"days_visited":{"one":"день заходив","few":"дня заходив","many":"днів заходив","other":"днів заходив"},"topics_entered":{"one":"подивився тему","few":"подивився тем","many":"переглянуто тем","other":"переглянуто тем"},"posts_read":{"one":"повідомлення прочитав","few":"повідомлення прочитав","many":"повідомлень прочитав","other":"повідомлень прочитав"},"bookmark_count":{"one":"закладка","few":"закладки","many":"закладок","other":"закладок"},"top_replies":"Кращі повідомлення","no_replies":"Ще не написав жодного повідомлення.","more_replies":"... інші повідомлення","top_topics":"Кращі теми","no_topics":"Поки не створив жодної теми.","more_topics":"Більше тем","top_badges":"Найпрестижніші нагороди","no_badges":"Ще не отримав жодної нагороди.","more_badges":"... інші нагороди","top_links":"Кращі посилання","no_links":"Поки немає посилань.","most_liked_by":"Шанувальники","most_liked_users":"Фаворити","most_replied_to_users":"Найактивніші співрозмовники","no_likes":"Поки жодної симпатії.","top_categories":"Кращі Категорії","topics":"Теми","replies":"Відповіді"},"ip_address":{"title":"Остання IP-адреса"},"registration_ip_address":{"title":"IP Адреса реєстрації"},"avatar":{"title":"Аватар","header_title":"профіль, повідомлення, закладки та налаштування"},"title":{"title":"Назва","none":"(немає)"},"primary_group":{"title":"Primary Group","none":"(немає)"},"filters":{"all":"Всі"},"stream":{"posted_by":"Опубліковано","sent_by":"Надіслано","private_message":"повідомлення","the_topic":"тема"}},"loading":"Завантаження...","errors":{"prev_page":"при спробі завантаження","reasons":{"network":"Помилка мережі","server":"Серверна помилка","forbidden":"Немає доступу","unknown":"Помилка","not_found":"Сторінка не знайдена"},"desc":{"network":"Будь ласка, перевірте з'єднання.","network_fixed":"Схоже, мережа з’явилася.","server":"Код помилки: {{status}}","forbidden":"Вам не дозволено це переглядати.","not_found":"Упс, сталася спроба завантажити неіснуюче посилання","unknown":"Щось пішло не так."},"buttons":{"back":"Повернутися","again":"Спробувати ще раз","fixed":"Завантаження Сторінки"}},"modal":{"close":"сховати"},"close":"Закрити","assets_changed_confirm":"Сайт тільки що був оновлений. Перезавантажити сторінку для переходу до нової версії?","logout":"Ви вийшли.","refresh":"Оновити","read_only_mode":{"enabled":"Сайт працює в режимі \"тільки для читання\". Зараз ви можете продовжувати переглядати сайт, але інші дії будуть недоступні. ","login_disabled":"Вхід вимкнено, поки сайт перебуває в режимі лише для читання.","logout_disabled":"Вихід відключений, поки сайт в режимі «тільки для читання»"},"logs_error_rate_notice":{},"learn_more":"дізнатися більше...","all_time":"всього","all_time_desc":"всього створено тем","year":"рік","year_desc":"теми, що були створені у останні 365 днів","month":"місяць","month_desc":"теми, що були створені у останні 30 днів","week":"тиждень","week_desc":"теми, що були створені у останні 7 днів","day":"день","first_post":"Перший допис","mute":"Mute","unmute":"Unmute","last_post":"Останнє повідомлення","time_read":"Прочитані","time_read_recently":"%{time_read} недавно","time_read_tooltip":"%{time_read} загальний час читання","time_read_recently_tooltip":"%{time_read} загальний час читання (%{recent_time_read} за останні 60 днів)","last_reply_lowercase":"остання відповідь","replies_lowercase":{"one":"відповідь","few":"відповіді","many":"відповідей","other":"відповідь"},"signup_cta":{"sign_up":"Зареєструватись","hide_session":"Нагадати мені завтра","hide_forever":"ні дякую","hidden_for_session":"Добре, нагадаю завтра. До речі, зареєструватися можна також та за допомогою кнопки \"Увійти\".","intro":"Вітаємо! Схоже, вам подобається обговорення, але ви ще не зареєстрували акаунт.","value_prop":"Коли ви створюєте обліковий запис, ми точно пам’ятаємо, що ви прочитали, тому ви завжди повертаєтеся туди, де зупинилися. Ви також отримуєте повідомлення, тут та електронною поштою, коли хтось відповідає вам. І ви можете, в повідомленнях, поставити - мені подобається. :heartpulse:"},"summary":{"enabled_description":"Ви переглядаєте витяг з теми - тільки найцікавіші повідомлення на думку спільноти.","description":"Є \u003cb\u003e{{replyCount}}\u003c/b\u003e відповідей.","description_time":"\u003cb\u003e{{replyCount}}\u003c/b\u003e відповідей з передбачуваним часом прочитання близько \u003cb\u003e{{readingTime}} хвилин\u003c/b\u003e.","enable":"Підсумки цієї теми","disable":"Показати всі дописи"},"deleted_filter":{"enabled_description":"Ця тема містить видалені дописи, які були сховані.","disabled_description":"Видалені дописи в цій темі показано.","enable":"Сховати видалені дописи","disable":"Показати видалені дописи"},"private_message_info":{"title":"Повідомлення","invite":"Запросити інших...","edit":"Додати або Видалити...","leave_message":"Ви дійсно хочете залишити це повідомлення?","remove_allowed_user":"Ви впевнені, що хочете видалити {{name}} з цього повідомлення?","remove_allowed_group":"Ви впевнені, що хочете видалити {{name}} з цього повідомлення?"},"email":"Електронна пошта","username":"Ім'я користувача","last_seen":"Помічено востаннє","created":"Створено","created_lowercase":"створено","trust_level":"Рівень довіри","search_hint":"ім'я користувача, email або IP-адреса","create_account":{"disclaimer":"Реєструючись, ви погоджуєтеся з \u003ca href='{{privacy_link}}' target='blank'\u003eполітикою конфіденційності\u003c/a\u003e та \u003ca href='{{tos_link}}' target='blank'\u003eумовами надання послуг\u003c/a\u003e.","title":"Створити Новий Обліковий Запис","failed":"Щось пішло не так; скоріше за все, цю електронну пошту вже зареєстровано, спробуйте посилання Забув пароль"},"forgot_password":{"title":"Скидання пароля","action":"Я забув(ла) свій пароль","invite":"Введіть своє ім'я користувача або адресу електронної скриньки, і ми надішлемо Вам лист для скинення пароля.","reset":"Скинути пароль","complete_username":"Якщо обліковий запис збігається з \u003cb\u003e%{username}\u003c/b\u003e, у найближчий час ви отримаєте email з інструкціями, як змінити ваш пароль.","complete_email":"Якщо обліковий запис збігається з \u003cb\u003e%{email}\u003c/b\u003e, ви повинні отримати лист з інструкціями про те, як швидко скинути ваш пароль.","complete_username_found":"Ми знайшли обліковий запис, який відповідає імені користувача \u003cb\u003e%{username}\u003c/b\u003e . Вам слід отримати електронний лист із інструкціями, як скинути пароль.","complete_email_found":"Ми знайшли обліковий запис, який відповідає \u003cb\u003e%{email}\u003c/b\u003e . Вам слід отримати електронний лист із інструкціями, як скинути пароль.","complete_username_not_found":"Не знайдено облікового запису з псевдонімом \u003cb\u003e%{username}\u003c/b\u003e","complete_email_not_found":"Не знайдено облікового запису з адресою електронної пошти \u003cb\u003e%{email}\u003c/b\u003e","help":"Електронний лист не доходить? Для початку перевірте папку «Спам» вашої поштової скриньки. \u003cp\u003eНе впевнені в тому, яку адресу використовували? Введіть його та ми підкажемо, чи є він в нашій базі.\u003c/p\u003e \u003cp\u003eЯкщо ви більше не маєте доступу до пов’язаного з вашим обліковим записом адресою електронної пошти, то, будь ласка, зв’яжіться з \u003ca href = '%{basePath } / about '\u003eадміністрацією.\u003c/a\u003e\u003c/p\u003e","button_ok":"OK","button_help":"Допомога"},"email_login":{"link_label":"Надішліть мені посилання для входу ","button_label":"E-mail","complete_username":"Якщо обліковий запис збігається з ім’ям користувача \u003cb\u003e%{username}\u003c/b\u003e, ви повинні отримати електронного листа з посиланням для входу в систему найближчим часом.","complete_email":"Якщо дані облікового запису збігаються з \u003cb\u003e%{email}\u003c/b\u003e, ви повинні отримати електронного листа з посиланням для входу в систему найближчим часом.","complete_username_found":"Ми знайшли обліковий запис, який відповідає імені користувача \u003cb\u003e%{username}\u003c/b\u003e, найближчим часом ви отримаєте електронного листа з посиланням для входу.","complete_email_found":"Ми знайшли обліковий запис, який відповідає \u003cb\u003e%{email}\u003c/b\u003e, найближчим часом ви отримаєте електронного листа з посиланням для входу.","complete_username_not_found":"Жодна обліковий запис не збігається з назвою користувача \u003cb\u003e%{username}\u003c/b\u003e","complete_email_not_found":"Немає збігів аккаунта по \u003cb\u003e%{email}\u003c/b\u003e","confirm_title":"Продовжити у %{site_name}","logging_in_as":"Ввійти як %{email}","confirm_button":"Завершити Вхід"},"login":{"title":"Увійти","username":"Користувач","password":"Пароль","second_factor_title":"Двофакторна автентифікація","second_factor_description":"Введіть код аутентифікації з вашого додатки:","second_factor_backup":"Увійти за допомогою запасного коду","second_factor_backup_title":"Запасний вхід двофакторної аутентифікації","second_factor_backup_description":"Введіть запасний код:","second_factor":"Увійти за допомогою програми аутентифікації","security_key_description":"Коли ви підготуєте свій фізичний ключ безпеки, натисніть кнопку Аутентификация з ключем безпеки нижче.","security_key_alternative":"Спробуйте інший спосіб","security_key_authenticate":"Аутентифікація з Ключем Безпеки.","security_key_not_allowed_error":"Час перевірки автентичності ключа безпеки минув або було скасовано.","security_key_no_matching_credential_error":"У зазначеному ключі безпеки не знайдено відповідних облікових даних.","security_key_support_missing_error":"Ваше поточне пристрій або браузер не підтримує використання ключів безпеки. Будь ласка, використовуйте інший метод.","email_placeholder":"електронна скринька або ім'я користувача","caps_lock_warning":"Caps Lock увімкнено","error":"Невідома помилка","cookies_error":"Схоже, що в вашому браузері вимкнені куки. Це завадить входу на сайт під своїм обліковим записом.","rate_limit":"Зробіть перерву перед черговою спробою входу.","blank_username":"Введіть ваш e-mail або псевдонім.","blank_username_or_password":"Введіть ваш e-mail (або псевдонім) та пароль.","reset_password":"Скинути пароль","logging_in":"Вхід...","or":"Або","authenticating":"Автентифікуємося...","awaiting_activation":"Ваш обліковий запис очікує на активацію. Для отримання ще одного активаційного листа використайте посилання Забув пароль.","awaiting_approval":"Ваш обліковий запис ще не затверджено членом команди. Коли його буде активовано, Ви отримаєте електронного листа.","requires_invite":"Даруйте, доступ до цього форуму - лише за запрошеннями.","not_activated":"Ви ще не можете увійти. Ми вже надіслали Вам листа для активації на скриньку \u003cb\u003e{{sentTo}}\u003c/b\u003e. Будь ласка, виконайте інструкції в цьому листі, щоб активувати обліковий запис.","not_allowed_from_ip_address":"З цієї IP адреси вхід заборонений.","admin_not_allowed_from_ip_address":"З цієї IP адреси вхід адміністраторів заборонений.","resend_activation_email":"Натисніть тут, щоб отримати ще один лист з активацією.","omniauth_disallow_totp":"У вашого профілю включена двухфакторная аутентифікація. Будь ласка, увійдіть під своїм паролем.","resend_title":"Надіслати ще раз листа для активації","change_email":"Змінити електронну скриньку","provide_new_email":"Вкажіть нову адресу електронної пошти, щоб задіяти його та заново вислати лист із кодом активації.","submit_new_email":"Оновити електронну пошту","sent_activation_email_again":"Ми надіслали на Вашу скриньку \u003cb\u003e{{currentEmail}}\u003c/b\u003e ще один лист для активації облікового запису. Протягом кількох хвилин він має з'явитися у Вашій скриньці. Не забувайте також перевіряти теку зі спамом.","sent_activation_email_again_generic":"Ми відправили ще один лист для активації. Це може зайняти кілька хвилин для того, щоб лист було доставлено; не забудьте перевірити папку зі спамом.","to_continue":"Будь ласка Увійдіть","preferences":"Необхідно увійти на сайт для редагування налаштувань профілю.","forgot":"Я не пам’ятаю дані мого профілю","not_approved":"Ваш обліковий запис ще не було схвалено. Ви отримаєте сповіщення на електронну скриньку, коли зможете увійти.","google_oauth2":{"name":"Google","title":"з Google"},"twitter":{"name":"Twitter","title":"через Twitter"},"instagram":{"name":"Instagram","title":"через Instagram"},"facebook":{"name":"Facebook","title":"через Facebook"},"github":{"name":"GitHub","title":"через GitHub"},"discord":{"name":"Discord","title":"з Discord"},"second_factor_toggle":{"totp":"Замість цього використовуйте додаток для перевірки автентичності","backup_code":"Замість цього використовуйте резервний код"}},"invites":{"accept_title":"Запрошення","welcome_to":"Ласкаво просимо до сайта %{site_name}!","invited_by":"Ви були запрошені:","social_login_available":"Ви також зможете входити через соціальні мережі, використовуючи цю адресу електронної пошти.","your_email":"Ваша електронна адреса аккаунта \u003cb\u003e%{email}\u003c/b\u003e.","accept_invite":"Прийняти запрошення","success":"Ваш аккаунт створений та ви можете тепер увійти.","name_label":"Ім'я","password_label":"Встановити пароль","optional_description":"(опціонально)"},"password_reset":{"continue":"Продовжити на %{site_name}"},"emoji_set":{"apple_international":"Apple/International","google":"Google","twitter":"Twitter","emoji_one":"JoyPixels (ранее EmojiOne)","win10":"Win10","google_classic":"Google Classic","facebook_messenger":"Facebook Messenger"},"category_page_style":{"categories_only":"Тільки розділи","categories_with_featured_topics":"Розділи та їх найкращі теми","categories_and_latest_topics":"Розділи та список останніх тем форуму","categories_and_top_topics":"Категорії та головні теми","categories_boxes":"Коробки з підкатегорій","categories_boxes_with_topics":"Коробки з Обраними Темами"},"shortcut_modifier_key":{"shift":"Shift","ctrl":"Ctrl","alt":"Alt","enter":"Увійти"},"conditional_loading_section":{"loading":"Завантаження..."},"category_row":{"topic_count":"{{count}} тем в цій категорії"},"select_kit":{"default_header_text":"Вибрати...","no_content":"Збігів, не знайдено","filter_placeholder":"Пошук...","filter_placeholder_with_any":"Знайти або створити...","create":"Створити: '{{content}}'","max_content_reached":{"one":"Можна вибрати тільки {{count}} елемент.","few":"Можна вибрати тільки {{count}} елементів.","many":"Можна вибрати тільки {{count}} елементів.","other":"Можна вибрати тільки {{count}} елемент."},"min_content_not_reached":{"one":"Введіть хоча б {{count}} елемент.","few":"Введіть хоча б {{count}} елементів.","many":"Введіть хоча б {{count}} елементів.","other":"Введіть хоча б {{count}} елемент."},"invalid_selection_length":"Вибір повинен містити не менше {{count}} символів."},"date_time_picker":{"from":"Від","to":"До","errors":{"to_before_from":"На сьогоднішній день має бути пізніше, ніж з дати."}},"emoji_picker":{"filter_placeholder":"Шукати emoji","smileys_\u0026_emotion":"Смайли та емоції","people_\u0026_body":"Люди та частини тіл","animals_\u0026_nature":"Тварини та Природа","food_\u0026_drink":"Їжа та Напої","travel_\u0026_places":"Подорожі та Місця","activities":"Діяльність","objects":"Objects","symbols":"Атрибутика","flags":"Скарги","recent":"Нещодавно використані","default_tone":"Немає скіна","light_tone":"Світлий тон скіна","medium_light_tone":"Середній світлий тон скіна","medium_tone":"Середній тон скіна","medium_dark_tone":"Середній темний тон скіна","dark_tone":"Темний відтінок скіна","default":"Призначені для користувача смайли"},"shared_drafts":{"title":"загальні Чернетки","notice":"Ці теми видно тільки тим, хто може бачити \u003cb\u003e{{category}}\u003c/b\u003e категорію.","destination_category":"Категорія Призначення","publish":"Публікація Спільної чернетки","confirm_publish":"Ви впевнені, що хочете опублікувати цю чернетку?","publishing":"Публікація теми..."},"composer":{"emoji":"Смайлики :)","more_emoji":"ще...","options":"Налаштування","whisper":"Внутрішнє повідомлення","unlist":"Виключена зі списків тем","blockquote_text":"Цитата","add_warning":"Це офіційне попередження.","toggle_whisper":"Внутрішнє повідомлення","toggle_unlisted":"Сховати зі списків тем","posting_not_on_topic":"На яку тему Ви хочете відповісти?","saved_local_draft_tip":"збережено локально","similar_topics":"Ваша тема схожа на...","drafts_offline":"чернетки в офлайні","edit_conflict":"Редагувати конфлікт","group_mentioned_limit":"\u003cb\u003eУвага!\u003c/b\u003e Ви згадали \u003ca href='{{group_link}}'\u003e{{group}}\u003c/a\u003e, в якій більше учасників, ніж встановлений адміністратором ліміт згадок на {{max}} користувачів. Ніхто не отримає сповіщення.","group_mentioned":{"one":"Згадуючи групу {{group}}, ви тем самим відправите повідомлення \u003ca href='{{group_link}}'\u003e%{count}му користувачеві\u003c/a\u003e - ви впевнені?","few":"Згадуючи групу {{group}}, ви тим самим відправите повідомлення \u003ca href='{{group_link}}'\u003e{{count}} користувачам\u003c/a\u003e - ви впевнені?","many":"Згадуючи групу {{group}}, ви тим самим відправите повідомлення \u003ca href='{{group_link}}'\u003e{{count}} користувачам\u003c/a\u003e - ви впевнені?","other":"Згадуючи групу {{group}}, ви тим самим відправите повідомлення \u003ca href='{{group_link}}'\u003e{{count}} користувачам\u003c/a\u003e - ви впевнені?"},"cannot_see_mention":{"category":"Ви згадали {{username}}, але вони не одержать повідомлення, тому що у них немає доступу до цього розділу. Вам потрібно додати їх до групи, що має доступ до цього розділу.","private":"Ви згадали {{username}}, але вони не одержать повідомлення, тому що вони не можуть бачити це приватне повідомлення. Вам потрібно запросити їх в це PM."},"duplicate_link":"Здається, ваше посилання на \u003cb\u003e{{domain}}\u003c/b\u003e вже була раніше розміщена користувачем \u003cb\u003e@{{username}}\u003c/b\u003e у \u003ca href='{{post_url}}'\u003eвідповіді {{ago}}\u003c/a\u003e. Ви точно хочете размістити її ще раз?","reference_topic_title":"RE: {{title}}","error":{"title_missing":"Заголовок є необхідним","title_too_short":"Заголовок має бути мінімум {{min}} символів","title_too_long":"Заголовок не може бути менше, ніж {{max}} символів","post_missing":"Повідомлення не може бути порожнім","post_length":"Найменший розмір допису має бути {{min}} символів","try_like":"Ви пробували натиснути на {{heart}} кнопку?","category_missing":"Ви повинні обрати категорію","tags_missing":"Ви маєте вибрати хоча б {{count}} міток","topic_template_not_modified":"Впишіть опис об’єкта в шаблон"},"save_edit":"Зберегти зміни","overwrite_edit":"Перезаписати, правити","reply_original":"Відповісти в початковій темі","reply_here":"Відповісти тут","reply":"Відповісти","cancel":"Скасувати","create_topic":"Створити тему","create_pm":"Повідомлення","create_whisper":"Внутрішнє повідомлення","create_shared_draft":"Створити Загальний проект","edit_shared_draft":"Редагувати загальну чернетку","title":"Або натисніть Ctrl+Enter","users_placeholder":"Додати користувача","title_placeholder":"Про що це обговорення, у одному короткому реченні?","title_or_link_placeholder":"Введіть назву, або вставте тут посилання","edit_reason_placeholder":"чому Ви редагуєте допис?","topic_featured_link_placeholder":"Введіть посилання, що відображається з назвою.","remove_featured_link":"Видалити посилання з теми.","reply_placeholder":"Підтримувані формати: Markdown, BBCode та HTML. Щоб вставити картинку, перетягніть її сюди або вставте за допомогою Ctrl + V, Command-V, або натисніть правою кнопкою миші та виберіть меню \"вставити\".","reply_placeholder_no_images":"Введіть тут. Використовуйте Markdown, BBCode або HTML для форматування.","reply_placeholder_choose_category":"Виберіть категорію перед введенням тут.","view_new_post":"Перегляньте свій новий допис.","saving":"Збереження","saved":"Збережено!","saved_draft":"Розмістити чернетку в процесі роботи. Натисніть, щоб продовжити.","uploading":"Завантаження...","show_preview":"попередній перегляд \u0026raquo;","hide_preview":"\u0026laquo; сховати попередній перегляд","quote_post_title":"Процитувати весь допис повністю","bold_label":"Ж","bold_title":"Сильне виділення","bold_text":"Сильне виділення тексту","italic_label":"К","italic_title":"Курсив","italic_text":"виділення тексту курсивом","link_title":"Гіперпосилання","link_description":"введіть опис посилання","link_dialog_title":"Вставити гіперпосилання","link_optional_text":"необов'язкова назва","link_url_placeholder":"Вставте URL або введіть для пошуку теми","quote_title":"Цитата","quote_text":"Цитата","code_title":"Попередньо форматований текст","code_text":"Впишіть сюди текст; також, відключити форматування тексту можна, почавши рядок з 4х прогалин","paste_code_text":"Надрукуйте або вставте сюди код","upload_title":"Завантажити","upload_description":"введіть опис завантаження","olist_title":"Нумерований список","ulist_title":"Маркований список","list_item":"Елемент списку","toggle_direction":"Переключити Напрямок","help":"Markdown Editing Help","collapse":"згорнути панель композитора","open":"відкрити панель композитора","abandon":"закрити композитор та скасувати чернетку","enter_fullscreen":"введіть повноекранний композитор","exit_fullscreen":"вийти з повноекранного режиму композитора","modal_ok":"OK","modal_cancel":"Скасувати","cant_send_pm":"На жаль, ви не можете відправляти повідомлення користувачу %{username}.","yourself_confirm":{"title":"Забули вказати одержувачів?","body":"У списку одержувачів зараз тільки ви самі!"},"admin_options_title":"Необов’язкові налаштування персоналу для цієї теми","composer_actions":{"reply":"Відповісти","draft":"Чернетка","edit":"Редагувати","reply_to_post":{"label":"Відповісти на повідомлення %{postNumber} від %{postUsername}","desc":"Відповідь на конкретний пост"},"reply_as_new_topic":{"label":"Відповісти в новій пов’язаної темі","desc":"Створити нову тему, пов’язану з цією темою","confirm":"У вас збережений нова чернетка теми, яка буде перезаписана, якщо ви створите пов’язану тему."},"reply_as_private_message":{"label":"Сворити нове","desc":"Створити нове приватне повідомлення"},"reply_to_topic":{"label":"Відповісти на тему","desc":"Відповідь на тему, а не який-небудь конкретний пост"},"toggle_whisper":{"label":"Включити шепіт","desc":"Шепіт видно тільки персоналу"},"create_topic":{"label":"Нова тема"},"shared_draft":{"label":"Загальний Проект","desc":"Проект теми, яку буде видно тільки співробітникам"},"toggle_topic_bump":{"label":"Не піднімати тему","desc":"Відповісти без зміни дати останньої відповіді"}},"details_title":"Підсумок","details_text":"Цей текст буде приховано"},"notifications":{"tooltip":{"regular":{"one":"%{count} невидиме повідомлення","few":"{{count}} невидимі повідомлення","many":"{{count}} невидимих ​​повідомлень","other":"{{count}} невидимі повідомлення"},"message":{"one":"%{count} непрочитані","few":"{{count}} непрочитаних повідомлень","many":"{{count}} непрочитаних повідомлень","other":"{{count}} непрочитаних повідомлень"}},"title":"повідомлення при згадці @псевдоніма, відповідях на ваші пости та теми, повідомлення та т.д.","none":"Повідомлення не можуть бути завантажені.","empty":"Повідомлення не знайдені.","post_approved":"Ваш пост був схвалений","reviewable_items":"пункти, що вимагають розгляду","mentioned":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","group_mentioned":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","quoted":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","bookmark_reminder":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","replied":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","posted":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","edited":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","liked":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","liked_2":"\u003cspan\u003e{{username}}, {{username2}}\u003c/span\u003e {{description}}","liked_many":{"one":"\u003cspan\u003e{{username}}, {{username2}} та %{count} інший\u003c/span\u003e {{description}}","few":"\u003cspan\u003e{{username}}, {{username2}} та {{count}} інші\u003c/span\u003e {{description}}","many":"\u003cspan\u003e{{username}}, {{username2}} та {{count}} інші\u003c/span\u003e {{description}}","other":"\u003cspan\u003e{{username}}, {{username2}} та {{count}} інші\u003c/span\u003e {{description}}"},"liked_consolidated_description":{"one":"Сподобався {{count}} ваш пост","few":"Сподобалося {{count}} ваших поста","many":"Сподобалося {{count}} ваших постів","other":"Сподобалося {{count}} ваших поста"},"liked_consolidated":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","private_message":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invited_to_private_message":"\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invited_to_topic":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invitee_accepted":"\u003cspan\u003e{{username}}\u003c/span\u003e принял ваше приглашение","moved_post":"\u003cspan\u003e{{username}}\u003c/span\u003e moved {{description}}","linked":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","granted_badge":"Заслужив(а) '{{description}}'","topic_reminder":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","watching_first_post":"\u003cspan\u003eНова тема\u003c/span\u003e {{description}}","membership_request_accepted":"Запит на вступ прийнятий '{{group_name}}'","membership_request_consolidated":"{{count}} відкрити запити на членство для \u0026quot;{{group_name}}\u0026quot;","group_message_summary":{"one":"{{count}} повідомлення в вашій групі: {{group_name}} ","few":"{{count}} повідомлень в вашій групі: {{group_name}} ","many":"{{count}} повідомлень в вашій групі: {{group_name}} ","other":"{{count}} повідомлень в вашій групі: {{group_name}} "},"popup":{"mentioned":"{{username}} згадав вас у \"{{topic}}\" - {{site_title}}","group_mentioned":"{{username}} згадав вас у \"{{topic}}\" - {{site_title}}","quoted":"{{username}} процитував вас у \"{{topic}}\" - {{site_title}}","replied":"{{username}} відповів вам у \"{{topic}}\" - {{site_title}}","posted":"{{username}} написав у \"{{topic}}\" - {{site_title}}","private_message":"{{username}} відправив вам приватне повідомлення в \"{{topic}}\" - {{site_title}}","linked":"{{username}} посилається на ваш пост у темі: \"{{topic}}\" - {{site_title}}","watching_first_post":"{{username}} створив нову тему \"{{topic}}\" - {{site_title}}","confirm_title":"Повідомлення включені - %{site_title}","confirm_body":"Успішно! Повідомлення були включені.","custom":"Повідомлення від {{username}} до %{site_title}"},"titles":{"mentioned":"згаданий","replied":"нову відповідь","quoted":"цитований","edited":"відредагований","liked":"нова симпатія","private_message":"нове приватне повідомлення","invited_to_private_message":"запрошений в приватне повідомлення","invitee_accepted":"запрошення прийнято","posted":"новий пост","moved_post":"повідомлення переміщено","linked":"пов’язаний","granted_badge":"нагорода отримана","invited_to_topic":"запрошений в тему","group_mentioned":"згадана група","group_message_summary":"нові групові повідомлення","watching_first_post":"нова тема","topic_reminder":"нагадування про тему","liked_consolidated":"нові симпатії","post_approved":"повідомлення затверджено","membership_request_consolidated":"нові запити на членство"}},"upload_selector":{"title":"Додати зображення","title_with_attachments":"Додати зображення або файл","from_my_computer":"З мого пристрою","from_the_web":"З інтернету","remote_tip":"посилання на зображення","remote_tip_with_attachments":"посилання на зображення або файл {{authorized_extensions}}","local_tip":"вибрати зображення з вашого пристрою","local_tip_with_attachments":"вибрати зображення або файли з вашого пристрою {{authorized_extensions}}","hint":"(Ви також можете перетягувати зображення в редактор, щоб їх завантажити)","hint_for_supported_browsers":"ви так само можете перетягнути або скопіювати зображення в редактор","uploading":"Завантаження","select_file":"Обрати файл","default_image_alt_text":"зображення"},"search":{"sort_by":"Сортувати за","relevance":"За змістом","latest_post":"Останній допис","latest_topic":"Остання тема","most_viewed":"Найбільш переглянуті","most_liked":"Найбільше симпатій","select_all":"Обрати все","clear_all":"Скинути все","too_short":"Занадто коротке слово для пошуку.","result_count":{"one":"\u003cspan\u003e%{count} результат для \u003c/span\u003e\u003cspan class='term'\u003e{{term}}\u003c/span\u003e","few":"\u003cspan\u003e{{count}} {{plus}} результатів для \u003c/span\u003e\u003cspan class='term'\u003e{{term}}\u003c/span\u003e","many":"\u003cspan\u003e{{count}} {{plus}} результат для \u003c/span\u003e\u003cspan class='term'\u003e{{term}}\u003c/span\u003e","other":"\u003cspan\u003e{{count}} {{plus}} результатів для \u003c/span\u003e\u003cspan class='term'\u003e{{term}}\u003c/span\u003e"},"title":"Пошук по темам, повідомленням, псевдонімам та розділам","full_page_title":"пошук тем або повідомлень","no_results":"Нічого не знайдено.","no_more_results":"Більше нічого не знайдено.","searching":"Пошук ...","post_format":"#{{post_number}} від {{username}}","results_page":"Результати пошуку для '{{term}}'","more_results":"Знайдено безліч результатів. Будь ласка, уточніть, критерії пошуку.","cant_find":"Не можете знайти потрібну інформацію?","start_new_topic":"Створити нову тему?","or_search_google":"Або спробуйте пошукати в Google:","search_google":"Спробуйте пошукати в Google:","search_google_button":"Google","search_google_title":"Пошук на цьому сайті","context":{"user":"Шукати повідомлення від @{{username}}","category":"Шукати в розділі #{{category}}","tag":"Шукати тег #{{tag}}","topic":"Пошук в цій темі","private_messages":"Шукати приватні повідомлення"},"advanced":{"title":"Розширений пошук","posted_by":{"label":"Опубліковано"},"in_category":{"label":"Разділи"},"in_group":{"label":"У групі"},"with_badge":{"label":"З нагородами"},"with_tags":{"label":"Позначено"},"filters":{"label":"Обмежити пошук по темам/повідомленням...","title":"Збігам в заголовку","likes":"Мені сподобалися","posted":"В яких я писав","created":"Я створив","watching":"За якими я спостерігаю","tracking":"За якими я стежу","private":"У моїх повідомленнях","bookmarks":"Мої закладки","first":"Тільки перші повідомлення в темах","pinned":"Закріплені","unpinned":"Не закріплені","seen":"Читання","unseen":"Позначити непрочитаними","wiki":"Є вікі","images":"включити зображення","all_tags":"Усі мітки вгорі"},"statuses":{"label":"Де теми","open":"відкрита","closed":"закрита","public":"є публічними","archived":"заархівувана","noreplies":"без відповідей","single_user":"зез відповідей"},"post":{"count":{"label":"Мінімум повідомлень в темі"},"time":{"label":"Дата","before":"перед","after":"після"}}}},"hamburger_menu":"перейти до іншого переліку або категорії тем","new_item":"новий","go_back":"повернутися назад","not_logged_in_user":"сторінка користувача з підсумком поточної діяльності та налаштуваннями","current_user":"перейти до Вашої сторінки користувача","view_all":"подивитись все","topics":{"new_messages_marker":"останнє відвідування","bulk":{"select_all":"Обрати все","clear_all":"Скасувати вибір","unlist_topics":"Виключити з усіх списків тем","relist_topics":"Повторний Список тем","reset_read":"Скинути прочитані","delete":"Видалити теми","dismiss":"Відкинути","dismiss_read":"Відхилити всі непрочитані","dismiss_button":"Відкласти...","dismiss_tooltip":"Відкласти нові повідомлення, або перестати стежити за цими темами","also_dismiss_topics":"Перестати стежити за цими темами, щоб вони ніколи більше не висвітлювались як непрочитані","dismiss_new":"Dismiss New","toggle":"перемикач масової дії над темами","actions":"Масові дії","change_category":"Задати розділ","close_topics":"Закрити теми","archive_topics":"Архівувати теми","notification_level":"Сповіщення","choose_new_category":"Виберіть новий розділ для цих тем:","selected":{"one":"Ви вибрали \u003cb\u003e{{count}}\u003c/b\u003e тему.","few":"Ви вибрали \u003cb\u003e{{count}}\u003c/b\u003e теми.","many":"Ви вибрали \u003cb\u003e{{count}}\u003c/b\u003e тем.","other":"Ви вибрали \u003cb\u003e{{count}}\u003c/b\u003e тем."},"change_tags":"Замінити мітки","append_tags":"Додати мітки","choose_new_tags":"Виберіть нові мітки для цих тем:","choose_append_tags":"Виберіть нові мітки, щоб додати що цих тем:","changed_tags":"Мітки цих тем було змінено."},"none":{"unread":"У Вас немає непрочитаних тем.","new":"У Вас немає нових тем.","read":"Ви ще не прочитали жодної теми.","posted":"Ви ще не дописували в жодну тему.","latest":"Останніх тем немає. Шкода.","bookmarks":"У вас немає обраних тем.","category":"В категорії {{category}} немає тем.","top":"There are no top topics.","educate":{"new":"\u003cp\u003eВаші нові теми скоро з’являться тут.\u003c/p\u003e\u003cp\u003eЗа замовчуванням, нові теми відзначаються іконкою: \u003cspan class=\"badge new-topic badge-notification\" style=\"vertical-align: middle; line-height: inherit;\"\u003eНова\u003c/span\u003e, якщо вона була створена протягом 2 тижнів.\u003c/p\u003e\u003cp\u003eПерейдіть в \u003ca href=\"%{userPrefsUrl}\"\u003eнастройки\u003c/a\u003e для того, щоб вибрати період активності нових тем.\u003c/p\u003e","unread":"\u003cp\u003eВаші непрочитані теми скоро з’являться тут.\u003c/p\u003e\u003cp\u003eЗа замовчуванням теми отримують лічильник \u003cspan class=\"badge new-posts badge-notification\"\u003e1\u003c/span\u003e, якщо:\u003c/p\u003e\u003cul\u003e\u003cli\u003eСтворена тема\u003c/li\u003e\u003cli\u003eВідповіли на тему\u003c/li\u003e\u003cli\u003eТема прочитана після закінчення 4 хвилин, після її створення\u003c/li\u003e\u003c/ul\u003e\u003cp\u003eЧи можна задати свої налаштування відстеження нових тем.\u003c/p\u003e\u003cp\u003eПерейдіть у свої \u003ca href=\"%{userPrefsUrl}\"\u003eналаштування\u003c/a\u003e.\u003c/p\u003e"}},"bottom":{"latest":"Більше немає останніх тем.","posted":"Створених тем більше немає.","read":"Більше немає прочитаних тем.","new":"Більше немає нових тем.","unread":"Більше немає непрочитаних тем.","category":"Більше немає тем в категорії {{category}}.","top":"Топових тем більше немає.","bookmarks":"Більше немає обраних тем."}},"topic":{"filter_to":{"one":"%{count} повідомлення в темі","few":"{{count}} повідомлення в темі","many":"{{count}} повідомлень в темі","other":"{{count}} повідомлень в темі"},"create":"Нова тема","create_long":"Створити нову тему","open_draft":"Відкрити чернетку","private_message":"Нове приватне повідомлення","archive_message":{"help":"Перемістити повідомлення в архів","title":"Архів"},"move_to_inbox":{"title":"Перемістити у Вхідні","help":"Перемістити повідомлення у вхідні"},"edit_message":{"help":"Змінити перше повідомлення","title":"Редагувати повідомлення"},"defer":{"help":"Позначити як непрочитане","title":"Відкласти"},"feature_on_profile":{"help":"Додайте посилання на цю тему на своїй картці та профілі користувача","title":"Вибрано у профілі"},"remove_from_profile":{"warning":"У вашому профілі вже є обрана тема. Якщо ви продовжите, ця тема замінить існуючу тему.","help":"Видаліть посилання на цю тему у своєму профілі користувача","title":"Видалити з профілю"},"list":"Теми","new":"нова тема","unread":"непрочитані","new_topics":{"one":"{{count}} нова тема","few":"{{count}} нових теми","many":"{{count}} нових тем","other":"{{count}} нових тем"},"unread_topics":{"one":"{{count}} непрочитана тема","few":"{{count}} непрочитані теми","many":"{{count}} непрочитаних тем","other":"{{count}} непрочитаних тем"},"title":"Тема","invalid_access":{"title":"Тема є приватною.","description":"Вибачте, у Вас немає доступу до цієї теми!","login_required":"Потрібно увійти для перегляду цієї теми."},"server_error":{"title":"Тему не вдалося завантажити","description":"Даруйте, ми не змогли завантажити цю тему, ймовірно, через проблему зі з'єднанням. Будь ласка, спробуйте ще раз. Якщо проблема залишається, дайте нам знати."},"not_found":{"title":"Тему не знайдено","description":"Даруйте, ми не змогли знайти цю тему. Можливо, її було видалено модератором?"},"total_unread_posts":{"one":"у вас {{count}} непрочитане повідомлення в цій темі","few":"у вас {{count}} непрочитаних повідомлення в цій темі","many":"у вас {{count}} непрочитаних повідомлення в цій темі","other":"у вас {{count}} непрочитаних повідомлення в цій темі"},"unread_posts":{"one":"у вас {{count}} непрочитане старе повідомлення в цій теме","few":"у вас {{count}} непрочитаних старих повідомлення в цій темі","many":"у вас {{count}} непрочитаних старих повідомлень в цій темі","other":"у вас {{count}} непрочитаних старих повідомлень в цій темі"},"new_posts":{"one":"в цій темі {{count}} нове повідомлення з її останнього перегляду вами","few":"в цій темі {{count}} нові повідомлення з її останнього перегляду вами","many":"в цій темі {{count}} нових повідомлень з її останнього перегляду вами","other":"в цій темі {{count}} нових повідомлень з її останнього перегляду вами"},"likes":{"one":"в темі {{count}} лайк","few":"в темі {{count}} лайка","many":"в темі {{count}} лайків","other":"в темі {{count}} лайків"},"back_to_list":"Повернутися до списку тем","options":"Налаштування теми","show_links":"показати посилання в цій темі","toggle_information":"показати/сховати деталі теми","read_more_in_category":"Хочете почитати ще? Перегляньте інші теми в {{catLink}} або {{latestLink}}.","read_more":"Хочете почитати ще? {{catLink}} або {{latestLink}}.","group_request":"Вам потрібно надіслати запит на приєднання в групу `{{name}}` щоб побачити цю тему.","group_join":"Вам потрібно приєднатися до групи `{{name}}` щоб побачити цю тему.","group_request_sent":"Ваш запит на членство в групі був відправлений. Вам повідомлять, коли буде схвалено.","unread_indicator":"Жоден учасник ще не прочитав останній пост цієї теми.","browse_all_categories":"Переглянути всі категорії","view_latest_topics":"перегляньте останні теми","suggest_create_topic":"Чому б не створити тему?","jump_reply_up":"перейти до ранішої відповіді","jump_reply_down":"перейти до пізнішої відповіді","deleted":"Тему було видалено","topic_status_update":{"title":"Таймер Теми","save":"Встановити Таймер","num_of_hours":"Кількість годин:","remove":"Видалити Таймер","publish_to":"Публікувати в:","when":"Коли:","public_timer_types":"Таймер теми","private_timer_types":"Таймер Тем користувача","time_frame_required":"Будь ласка, виберіть період часу"},"auto_update_input":{"none":"Вибір таймфрейма","later_today":"Пізніше сьогодні","tomorrow":"Завтра","later_this_week":"Пізніше на цьому тижні","this_weekend":"В ці вихідні","next_week":"На наступному тижні","two_weeks":"Два тижні","next_month":"В наступному місяці","two_months":"Два місяці","three_months":"Три місяці","four_months":"Чотири місяці","six_months":"Шість місяців","one_year":"Один рік","forever":"Назавжди","pick_date_and_time":"Вибрати дату та час","set_based_on_last_post":"Закрити після останнього повідомлення"},"publish_to_category":{"title":"Розклад публікації"},"temp_open":{"title":"Відкрити на час"},"auto_reopen":{"title":"Автоматичне відкриття теми"},"temp_close":{"title":"Закрити на час"},"auto_close":{"title":"Автоматичне закриття теми","label":"Закрити тему через:","error":"Будь ласка, введіть коректне значення.","based_on_last_post":"Не закривайте, поки останній пост в темі не стане занадто старим."},"auto_delete":{"title":"Автоматичне видалення теми"},"auto_bump":{"title":"Само-підняття теми"},"reminder":{"title":"Нагадати мені"},"status_update_notice":{"auto_open":"Ця тема автоматично відкриється через %{timeLeft}.","auto_close":"Ця тема автоматично закриється %{timeLeft}.","auto_publish_to_category":"Ця тема буде опублікована в розділі \u003ca href=%{categoryUrl}\u003e#%{categoryName}\u003c/a\u003e через %{timeLeft}.","auto_close_based_on_last_post":"Ця тема буде закрита через %{duration} після останньої відповіді.","auto_delete":"Ця тема буде автоматично видалена через %{timeLeft}.","auto_bump":"Ця тема буде автоматично піднята %{timeLeft}.","auto_reminder":"Вам прийде нагадування про цю тему через %{timeLeft}."},"auto_close_title":"Налаштування автоматичного закриття","auto_close_immediate":{"one":"Останнє повідомлення в цій темі відправлено %{count} годину тому, а тому дана тема буде закрита негайно.","few":"Останнє повідомлення в цій темі відправлено %{count} години назад, а тому дана тема буде закрита негайно.","many":"Останнє повідомлення в цій темі відправлено %{count} годин тому, а тому дана тема буде закрита негайно.","other":"Останнє повідомлення в цій темі відправлено %{count} годин тому, а тому дана тема буде закрита негайно."},"timeline":{"back":"Назад","back_description":"Переглянути останнє непрочитане повідомлення","replies_short":"%{current} / %{total}"},"progress":{"title":"просування по темі","go_top":"перейти вгору","go_bottom":"перейти вниз","go":"=\u003e","jump_bottom":"перейти до останнього допису","jump_prompt":"перейти до...","jump_prompt_of":"з %{count} повідомлень","jump_prompt_long":"Перейти до...","jump_bottom_with_number":"перейти до допису %{post_number}","jump_prompt_to_date":"дата","jump_prompt_or":"або","total":"всього дописів","current":"поточний допис"},"notifications":{"title":"змінити частоту повідомлень про цю тему","reasons":{"mailing_list_mode":"Ви включили режим поштової розсилки, тому Ви будете отримувати повідомлення про відповіді в цій темі через e-mail.","3_10":"Ви будете отримувати сповіщення, тому що слідкуєте за міткою у цій темі.","3_6":"Ви будете отримувати сповіщення, бо Ви слідкуєте за цією категорією.","3_5":"Ви будете отримувати сповіщення, бо Ви автоматично почали слідкувати за цією темою.","3_2":"Ви будете отримувати сповіщення, бо Ви слідкуєте за цією темою.","3_1":"Ви будете отримувати сповіщення, бо Ви створили цю тему.","3":"Ви будете отримувати сповіщення, бо Ви слідкуєте за цією темою.","2_8":"Ви побачите кількість нових відповідей, тому що стежте за цим розділом.","2_4":"Ви побачите кількість нових відповідей, тому що ви розміщували відповідь в цій темі.","2_2":"Ви побачите кількість нових відповідей, тому що стежте за цією темою.","2":"Ви побачите кількість нових відповідей, тому що \u003ca href=\"{{basePath}}/u/{{username}}/preferences\"\u003eчитали цю тему\u003c/a\u003e.","1_2":"Ви будете сповіщені, якщо хтось згадує ваше @ім'я чи відповідає вам.","1":"Ви будете сповіщені, якщо хтось згадує ваше @ім'я чи відповідає вам.","0_7":"Ви ігноруєте всі сповіщення у цій категорії.","0_2":"Ви ігноруєте всі сповіщення з цієї теми.","0":"Ви ігноруєте всі сповіщення з цієї теми."},"watching_pm":{"title":"Слідкувати","description":"Надсилати по кожній відповіді на це повідомлення та показувати лічильник нових непрочитаних відповідей."},"watching":{"title":"Слідкувати","description":"Надсилати по кожному новому повідомленню в цій темі та показувати лічильник нових непрочитаних відповідей."},"tracking_pm":{"title":"Стежити","description":"Кількість непрочитаних повідомлень з’явиться поруч з цим повідомленням. Вам прийде повідомлення, тільки якщо хтось згадає ваш @псевдонім або відповість на ваше повідомлення."},"tracking":{"title":"Стежити","description":"Кількість непрочитаних повідомлень з’явиться поруч з назвою цієї теми. Вам прийде повідомлення, тільки якщо хтось згадає ваш @псевдонім або відповість на ваше повідомлення."},"regular":{"title":"Нормальний","description":"Ви будете сповіщені, якщо хтось згадує ваше @ім'я чи відповідає вам."},"regular_pm":{"title":"Нормальний","description":"Ви будете сповіщені, якщо хтось згадує ваше @ім'я чи відповідає вам."},"muted_pm":{"title":"Ігнорувати","description":"Ніколи не отримувати повідомлень, пов’язаних з цією розмовою."},"muted":{"title":"Ігнорувати","description":"Не повідомляти про зміни в цій темі та приховати її з останніх."}},"actions":{"title":"Дії","recover":"Відкликати видалення теми","delete":"Видалити тему","open":"Відкрити тему","close":"Закрити тему","multi_select":"Вибрати повідомлення...","timed_update":"Дія за таймером...","pin":"Закріпити тему...","unpin":"Відмінити закріплення теми...","unarchive":"Розархівувати тему","archive":"Заархівувати тему","invisible":"Виключити зі списків","visible":"Включити в списки","reset_read":"Скинути дані про прочитаність","make_public":"Зробити тему публічною","make_private":"Особисте повідомлення","reset_bump_date":"Скинути дату підняття"},"feature":{"pin":"Закріпити тему","unpin":"Відкріпити тему","pin_globally":"Закріпити тему глобально","make_banner":"Створити оголошення","remove_banner":"Видалити оголошення"},"reply":{"title":"Відповісти","help":"почати складати відповідь на цю тему"},"clear_pin":{"title":"Відкріпити","help":"Скасувати закріплення цієї теми, щоб вона більше не з'являлася на початку Вашого переліку тем"},"share":{"title":"Поширити","extended_title":"Поділитися посиланням","help":"Поширити посилання на цю тему"},"print":{"title":"Друк","help":"Відкрити версію для друку"},"flag_topic":{"title":"Скарга","help":"поскаржитися на повідомлення","success_message":"Ви поскаржилися на тему."},"make_public":{"title":"Перетворити в Публічну тему","choose_category":"Будь ласка, виберіть категорію для публічної теми:"},"feature_topic":{"title":"Закріпити цю тему","pin":"Закріпити цю тему вгорі розділу {{categoryLink}} до","confirm_pin":"У вас вже є закріплена тема в розділі ({{count}}). Перебір таких тем може виявитися неприємною незручністю для новачків та анонімних читачів. Ви впевнені, що хочете закріпити ще одну тему в цьому розділі?","unpin":"Скасувати закріплення цієї теми вгорі розділу {{categoryLink}}.","unpin_until":"Скасувати закріплення цієї теми вгорі розділу {{categoryLink}} (станеться автоматично \u003cstrong\u003e%{until}\u003c/strong\u003e).","pin_note":"Користувачі можуть відкріпити тему, кожен сам для себе.","pin_validation":"Щоб закріпити цю тему, потрібна дата.","not_pinned":"У розділі {{categoryLink}} немає закріплених тем.","already_pinned":{"one":"Глобально закріплених тем в розділі {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e%{count}\u003c/strong\u003e","few":"Глобально закріплених тем в розділі {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e","many":"Глобально закріплених тем в розділі {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e","other":"Глобально закріплених тем в розділі {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"pin_globally":"Закріпити цю тему вгорі всіх розділів та списків тем до","confirm_pin_globally":"У вас вже є глобально закріплені теми ({{count}}). Перебір таких тем може виявитися неприємним незручністю для новачків та анонімних читачів. Ви впевнені, що хочете глобально закріпити ще одну тему?","unpin_globally":"Скасувати прикріплення цієї теми вгорі всіх розділів та списків тем.","unpin_globally_until":"Скасувати прикріплення цієї теми вгорі всіх розділів та списків тем (станеться автоматично \u003cstrong\u003e%{until}\u003c/strong\u003e).","global_pin_note":"Користувачі можуть відкріпити тему, кожен сам для себе.","not_pinned_globally":"Немає глобально закріплених тем.","already_pinned_globally":{"one":"Глобально закріплених тем: \u003cstrong class='badge badge-notification unread'\u003e%{count}\u003c/strong\u003e","few":"Глобально закріплених тем: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e","many":"Глобально закріплених тем: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e","other":"Глобально закріплених тем: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"make_banner":"Перетворити цю тему в оголошення, яке буде відображатися вгорі всіх сторінок.","remove_banner":"Прибрати тему-оголошення, яке відображається у верхній частині всіх сторінок.","banner_note":"Користувачі можуть закривати оголошення, кожен сам для себе, після чого воно більше не буде для них покиваться. Тільки одна тема може бути зроблена активним оголошенням в будь-який момент часу.","no_banner_exists":"Немає поточних тем-оголошень.","banner_exists":"На даний момент \u003cstrong class='badge badge-notification unread'\u003eвже є\u003c/strong\u003e тема-оголошення."},"inviting":"Запрошуємо...","automatically_add_to_groups":"Це запрошення надасть доступ до таких груп:","invite_private":{"title":"Запросити в бесіду","email_or_username":"Електронна скринька або ім'я запрошуваного користувача","email_or_username_placeholder":"електронна скринька або ім'я користувача","action":"Запросити","success":"Ми запросили цього користувача взяти участь в бесіді.","success_group":"Ми запросили цю групу взяти участь в бесіді.","error":"Даруйте, під час запрошення цього користувача сталася помилка.","group_name":"назва групи"},"controls":"Управління темою","invite_reply":{"title":"Запрошення","username_placeholder":"ім'я користувача","action":"Надіслати запрошення","help":"запросити інших в цю тему за допомогою email або повідомлень","to_forum":"Буде відправлено короткого листа, яке дозволить вашому другу приєднатися просто клікнувши на посилання без необхідності входу на сайт.","sso_enabled":"Введіть псевдонім користувача, якого ви хочете запросити в цю тему.","to_topic_blank":"Введіть псевдонім або email користувача, якого ви хочете запросити в цю тему.","to_topic_email":"Ви вказали адресу електронної пошти. Ми відправимо запрошення, яке дозволить вашому другу негайно відповісти в цій темі.","to_topic_username":"Ви вказали псевдонім користувача. Ми відправимо йому повідомлення з посиланням, щоб запросити його в цю тему.","to_username":"Введіть псевдонім користувача, якого ви хочете запросити в цю тему. Ми відправимо йому повідомлення про те що ви запрошуєте його приєднатися до цієї теми.","email_placeholder":"електронна скринька","success_email":"Запрошення відправлено за адресою \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e. Ми повідомимо Вас, коли цим запрошенням скористаються. Перевірте вкладку Запрошення на вашій сторінці користувача, щоб дізнатися про стан всіх ваших запрошень.","success_username":"Ми запросили цього користувача взяти участь в темі.","error":"На жаль, ми не змогли запросити цю людину. Можливо, він уже був запрошений? (Запрошення обмежені рейтингом)","success_existing_email":"Користувач з електронною поштою \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e вже існує. Ми запросили цього користувача взяти участь в цій темі."},"login_reply":"Увійдіть, щоб відповісти","filters":{"n_posts":{"one":"{{count}} повідомлення","few":"{{count}} повідомлення","many":"{{count}} повідомлень","other":"{{count}} повідомлень"},"cancel":"Прибрати фільтр"},"move_to":{"title":"Перемістити у","action":"перемістити в","error":"При переміщенні поста сталася помилка."},"split_topic":{"title":"Перенесення до нової теми","action":"перенести до нової теми","topic_name":"Назва нової теми","radio_label":"Нова тема","error":"Під час перенесення дописів до нової теми трапилася помилка.","instructions":{"one":"Зараз ви створите нову тему та в неї переміститься вибране вами \u003cb\u003e{{count}}\u003c/b\u003e повідомлення.","few":"Зараз ви створите нову тему та в неї перемістяться вибрані вами \u003cb\u003e{{count}}\u003c/b\u003e повідомлення.","many":"Зараз ви створите нову тему та в неї перемістяться вибрані вами \u003cb\u003e{{count}}\u003c/b\u003e повідомлень.","other":"Зараз ви створите нову тему та в неї перемістяться вибрані вами \u003cb\u003e{{count}}\u003c/b\u003e повідомлень."}},"merge_topic":{"title":"Перенесення до наявної теми","action":"перенести до наявної теми","error":"Під час перенесення дописів до цієї теми трапилася помилка.","radio_label":"Існуюча тема","instructions":{"one":"Будь ласка, виберіть тему, в яку ви хотіли б перемістити це \u003cb\u003e{{count}}\u003c/b\u003e повідомлення.","few":"Будь ласка, виберіть тему, в яку ви хотіли б перемістити ці \u003cb\u003e{{count}}\u003c/b\u003e повідомлення.","many":"Будь ласка, виберіть тему, в яку ви хотіли б перемістити ці \u003cb\u003e{{count}}\u003c/b\u003e повідомлень.","other":"Будь ласка, виберіть тему, в яку ви хотіли б перемістити ці \u003cb\u003e{{count}}\u003c/b\u003e повідомлень."}},"move_to_new_message":{"title":"Перейти до нового повідомленням","action":"перейти до нового повідомлення","message_title":"Нова тема повідомлення","radio_label":"Нове повідомлення","participants":"Учасники","instructions":{"one":"Ви збираєтеся створити нове повідомлення та заповнити його обраним вами повідомленням.","few":"Ви збираєтеся створити нове повідомлення та заповнити його \u003cb\u003e{{count}}\u003c/b\u003e повідомленнями, які ви вибрали.","many":"Ви збираєтеся створити нове повідомлення та заповнити його \u003cb\u003e{{count}}\u003c/b\u003e повідомленнями, які ви вибрали.","other":"Ви збираєтеся створити нове повідомлення та заповнити його \u003cb\u003e{{count}}\u003c/b\u003e повідомленнями, які ви вибрали."}},"move_to_existing_message":{"title":"Перейти до існуючого повідомлення","action":"перейти до існуючого повідомлення","radio_label":"Існуюче повідомлення","participants":"Учасники","instructions":{"one":"Будь ласка, виберіть повідомлення, в яке ви хочете перемістити це повідомлення.","few":"Будь ласка, виберіть повідомлення, яке ви хочете перемістити \u003cb\u003e{{count}}\u003c/b\u003e повідомлень.","many":"Будь ласка, виберіть повідомлення, яке ви хочете перемістити \u003cb\u003e{{count}}\u003c/b\u003e повідомлень.","other":"Будь ласка, виберіть повідомлення, яке ви хочете перемістити \u003cb\u003e{{count}}\u003c/b\u003e повідомлення."}},"merge_posts":{"title":"З’єднати виділені повідомлення","action":"З’єднати виділені повідомлення","error":"Сталася помилка під час з’єднання виділених повідомлень."},"change_owner":{"title":"Змінити Власника","action":"змінити власність","error":"Виникла помилка при зміні власника дописів.","placeholder":"ім'я користувача нового власника","instructions":{"one":"Будь ласка, виберіть нового власника для повідомлення \u003cb\u003e@{{old_user}}\u003c/b\u003e","few":"Будь ласка, виберіть нового власника для повідомлень \u003cb\u003e@{{old_user}}\u003c/b\u003e","many":"Будь ласка, виберіть нового власника для повідомлень \u003cb\u003e@{{old_user}}\u003c/b\u003e","other":"Будь ласка, виберіть нового власника {{count}} повідомлень для \u003cb\u003e@{{old_user}}\u003c/b\u003e"}},"change_timestamp":{"title":"Змінити дату...","action":"змінити часову мітку","invalid_timestamp":"Тимчасова мітка не може бути в майбутньому","error":"При зміні часової мітки теми виникла помилка","instructions":"Будь ласка, виберіть нову тимчасову мітку. Повідомлення в темі будуть оновлені, щоб прибрати тимчасові відмінності."},"multi_select":{"select":"вибрати","selected":"вибрано ({{count}})","select_post":{"label":"вибрати","title":"Додати повідомлення в виділення"},"selected_post":{"label":"обраний","title":"Натисніть, щоб видалити повідомлення з вибірки"},"select_replies":{"label":"select +replies","title":"Додати запис та всі відповіді для вибору"},"select_below":{"label":"вибрати + все нижче","title":"Додати запис та всі відповіді для вибору"},"delete":"видалити вибрані","cancel":"скасувати вибір","select_all":"обрати усе","deselect_all":"скасувати вибір всього","description":{"one":"Ви обрали \u003cb\u003e%{count}\u003c/b\u003e допис.","few":"Ви обрали дописів: \u003cb\u003e{{count}}\u003c/b\u003e.","many":"Ви обрали дописів: \u003cb\u003e{{count}}\u003c/b\u003e.","other":"Ви обрали дописів: \u003cb\u003e{{count}}\u003c/b\u003e."}},"deleted_by_author":{"one":"(Тема відкликана автором та буде автоматично видалена протягом %{count} години, якщо тільки на повідомлення не надійде скарга)","few":"(Тема відкликана автором та буде автоматично видалена протягом %{count} години, якщо тільки на повідомлення не надійде скарга)","many":"(Тема відкликана автором та буде автоматично видалена протягом %{count} годин, якщо тільки на повідомлення вступить скарга)","other":"(Тема відкликана автором та буде автоматично видалена протягом %{count} годин, якщо тільки на повідомлення вступить скарга)"}},"post":{"quote_reply":"Цитата","edit_reason":"Причина: ","post_number":"допис {{number}}","ignored":"проігнороване зміст","wiki_last_edited_on":"вики редагував","last_edited_on":"допис востаннє редаговано","reply_as_new_topic":"Відповісти в новій пов’язаної темі","reply_as_new_private_message":"Відповісти новим повідомленням тем же адресатам","continue_discussion":"В продовження дискусії {{postLink}}:","follow_quote":"перейти до цитованого допису","show_full":"Показати Увесь Допис","show_hidden":"Перегляд ігнорованого вмісту.","deleted_by_author":{"one":"(повідомлення відкликано автором та буде автоматично видалено протягом %{count} години, якщо тільки на повідомлення не надійде скарга)","few":"(повідомлення відкликано автором та буде автоматично видалено протягом %{count} годин, якщо тільки на повідомлення вступить скарга)","many":"(повідомлення відкликано автором та буде автоматично видалено протягом %{count} годин, якщо тільки на повідомлення вступить скарга)","other":"(повідомлення відкликано автором та буде автоматично видалено протягом %{count} годин, якщо тільки на повідомлення вступить скарга)"},"collapse":"згорнути","expand_collapse":"розгорнути/згорнути","locked":"співробітник заблокував це повідомлення для редагування","gap":{"one":"переглянути {{count}} приховану відповідь","few":"переглянути {{count}} прихованих відповідей","many":"переглянути {{count}} прихованих відповідей","other":"переглянути {{count}} прихованих відповідей"},"notice":{"new_user":"Це перша публікація {{user}} - давайте привітаємо його в нашій спільноті!","returning_user":"Минуло багато часу з тих пір, як ми бачили {{user}} - його останній пост був {{time}}."},"unread":"Допис не прочитаний","has_replies":{"one":"{{count}} відповідь","few":"{{count}} відповіді","many":"{{count}} відповідей","other":"{{count}} відповідей"},"has_likes_title":{"one":"Це повідомлення сподобалося {{count}} людині","few":"Це повідомлення сподобалося {{count}} людям","many":"Це повідомлення сподобалося {{count}} людям","other":"Це повідомлення сподобалося {{count}} людям"},"has_likes_title_only_you":"Вам сподобався цей повідомлення","has_likes_title_you":{"one":"Вам та ще %{count} людині сподобалося це повідомлення","few":"Вам та ще {{count}} людям сподобалося це повідомлення","many":"Вам та ще {{count}} людям сподобалося це повідомлення","other":"Вам та ще {{count}} людям сподобалося це повідомлення"},"errors":{"create":"Даруйте, під час створення допису трапилася помилка. Будь ласка, спробуйте ще раз.","edit":"Даруйте, під час редагування допису трапилася помилка. Будь ласка, спробуйте ще раз.","upload":"Даруйте, під час завантаження цього файлу трапилася помилка. Будь ласка, спробуйте ще раз.","file_too_large":"На жаль, цей файл надто великий (максимально допустимий розмір {{max_size_kb}} КБ). Чому б не завантажити цей файл в службу хмарного обміну, а потім поділитися посиланням?","too_many_uploads":"Даруйте, але Ви можете одночасно завантажувати тільки один файл.","too_many_dragged_and_dropped_files":"Вибачте, ви можете завантажити тільки {{max}} файл.","upload_not_authorized":"На жаль, ви не можете завантажити файл даного типу (список дозволених типів файлів: {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"Даруйте, нові користувачі не можуть завантажувати зображення.","attachment_upload_not_allowed_for_new_user":"Даруйте, нові користувачі не можуть завантажувати прикріплення.","attachment_download_requires_login":"Увійдіть, щоб скачувати прикріплені файли."},"abandon_edit":{"confirm":"Ви впевнені, що хочете скасувати свої зміни?","no_value":"Ні, зачекайте","no_save_draft":"Ні, зберегти чернетку","yes_value":"Так, скасувати зміни"},"abandon":{"confirm":"Ви впевнені, що хочете облишити цей допис?","no_value":"Ні, зачекайте","no_save_draft":"Ні, зберегти чернетку","yes_value":"Так, облишити"},"via_email":"це повідомлення прийшло з пошти","via_auto_generated_email":"це повідомлення прийшло з автоматично згенерованого e-mail","whisper":"Це внутрішнє повідомлення, тобто воно видно тільки модераторам","wiki":{"about":"це вікі-повідомлення"},"archetypes":{"save":"Зберегти налаштування"},"few_likes_left":"Дякуємо, що ділитеся любов’ю. На сьогодні у Вас залишилося кілька лайків.","controls":{"reply":"почати складати відповідь на цей допис","like":"вподобати цей допис","has_liked":"Вам сподобався цей допис","read_indicator":"користувачі, які читають цей пост","undo_like":"прибрати вподобання","edit":"редагувати цей допис","edit_action":"Редагувати","edit_anonymous":"Увійдіть, щоб відредагувати це повідомлення.","flag":"приватно поскаржитися на цей допис","delete":"видалити цей допис","undelete":"скасувати видалення цього допису","share":"поширити посилання на цей допис","more":"Більше","delete_replies":{"confirm":"Ви також хочете видалити відповіді на цей пост?","direct_replies":{"one":"Так, та %{count} пряму відповідь","few":"Так, та {{count}} прямих відповідей","many":"Так, та {{count}} прямих відповідей","other":"Так, та {{count}} пряму відповідь"},"all_replies":{"one":"Так, та %{count} відповідь","few":"Так, та всі {{count}} відповіді","many":"Так, та всі {{count}} відповіді","other":"Так, та всі {{count}} відповіді"},"just_the_post":"Ні, тільки цей допис"},"admin":"дії адміністратора над повідомленням","wiki":"Зробити вікі-повідомленням","unwiki":"Скасувати вікі-повідомлення","convert_to_moderator":"Додати колір модератора","revert_to_regular":"Прибрати колір модератора","rebake":"Перебудувати HTML","unhide":"Знову зробити видимим","change_owner":"Змінити власника","grant_badge":"Надати Значок","lock_post":"Заморозити повідомлення","lock_post_description":"заборонити автору редагувати цей пост","unlock_post":"Розморозити повідомлення","unlock_post_description":"Дозволити автору редагувати цей пост","delete_topic_disallowed_modal":"У вас немає дозволу на видалення цієї теми. Якщо ви дійсно хочете, щоб вона була видалена, використовуйте функцію прапора модератору разом з аргументацією.","delete_topic_disallowed":"у вас немає дозволу на видалення цієї теми","delete_topic":"видалити тему","add_post_notice":"Повідомлення модератору","remove_post_notice":"Видалити повідомлення модератору","remove_timer":"скасувати таймер"},"actions":{"flag":"Поскаржитися","defer_flags":{"one":"Ігнорувати скаргу","few":"ігнорувати скарги","many":"ігнорувати скарги","other":"ігнорувати скарги"},"undo":{"off_topic":"Відкликати скаргу","spam":"Відкликати скаргу","inappropriate":"Відкликати скаргу","bookmark":"Скасувати закладку","like":"Скасувати вподобання"},"people":{"off_topic":"це позначено як поза темою","spam":"flagged this as spam","inappropriate":"flagged this as inappropriate","notify_moderators":"notified moderators","notify_user":"надіслати повідомлення","bookmark":"Додати закладку","like":{"one":"сподобалось це","few":"сподобалось це","many":"сподобалось це","other":"вподобав це"},"read":{"one":"Прочитай це","few":"Прочитай це","many":"Прочитай це","other":"прочитав це"},"like_capped":{"one":"та {{count}} сподобалося","few":"і {{count}} іншим сподобалося","many":"і {{count}} іншим сподобалося","other":"і {{count}} іншим сподобалося"},"read_capped":{"one":"та {{count}} інші читають це","few":"та {{count}} інші читали це","many":"та {{count}} інші читали це","other":"та {{count}} інші прочитали це"}},"by_you":{"off_topic":"Ви поскаржилися на це як на недотичне до теми","spam":"Ви поскаржилися на це як на спам","inappropriate":"Ви поскаржилися на це як на неприпустиме","notify_moderators":"Ви позначили допис для модерації","notify_user":"Ви відправили повідомлення цьому користувачеві","bookmark":"Ви лишили тут закладку","like":"Ви це вподобали"}},"delete":{"confirm":{"one":"Ви впевнені, що хочете видалити це повідомлення?","few":"Ви впевнені, що хочете видалити {{count}} повідомлення?","many":"Ви впевнені, що хочете видалити {{count}} повідомлень?","other":"Ви впевнені, що хочете видалити {{count}} повідомлень?"}},"merge":{"confirm":{"one":"Ви впевнені, що хочете об’єднати ці повідомлення?","few":"Are you sure you want to merge those {{count}} posts?","many":"Are you sure you want to merge those {{count}} posts?","other":"Are you sure you want to merge those {{count}} posts?"}},"revisions":{"controls":{"first":"Перша версія","previous":"Попередня версія","next":"Наступна версія","last":"Остання версія","hide":"Приховати версію","show":"Показати версію","revert":"Відкат до цієї версії","edit_wiki":"редагувати Wiki","edit_post":"редагувати запис","comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e {{icon}} \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"},"displays":{"inline":{"title":"Показати результат виведення зі змінами на місці","button":"HTML"},"side_by_side":{"title":"Показати бік-о-бік результати виведення","button":"HTML"},"side_by_side_markdown":{"title":"Показати відмінності редакцій пліч-о-пліч","button":"Необроблений"}}},"raw_email":{"displays":{"raw":{"title":"Показати вихідний лист","button":"Джерело"},"text_part":{"title":"Показати текстову версію листа","button":"Текст"},"html_part":{"title":"Показати HTML версію листа","button":"HTML"}}},"bookmarks":{"create":"Створити закладку","created":"Створено","name":"Назва","actions":{"delete_bookmark":{"name":"Видалити закладку","description":"Вилучає закладку з вашого профілю та зупиняє всі нагадування про закладку"}}}},"category":{"can":"може\u0026hellip; ","none":"(без категорії)","all":"Всі категорії","choose":"категорії \u0026hellip;","edit":"Редагувати","edit_dialog_title":"Редагувати:%{categoryName}","view":"Переглянути теми, що належать до категорії","general":"Основне","settings":"Налаштування","topic_template":"Шаблон теми","tags":"Мітки","tags_allowed_tags":"Обмежити ці мітки до цієї категорії:","tags_allowed_tag_groups":"Обмежити ці групи міток до цієї категорії:","tags_placeholder":"(Необов'язково) список дозволених міток","tags_tab_description":"Теги та групи тегів, зазначені вище, будуть доступні лише в цій категорії та інших категоріях, які також їх визначають. Вони не будуть доступні для використання в інших категоріях.","tag_groups_placeholder":"(Необов'язково) список дозволених груп міток","manage_tag_groups_link":"Керувати групами міток тут","allow_global_tags_label":"Також дозволити інші мітки","tag_group_selector_placeholder":"(Необов’язково) Група тегів","required_tag_group_description":"Потрібні нові теми, щоб мати теги з групи тегів:","min_tags_from_required_group_label":"Кількість тегів:","required_tag_group_label":"Група тегів:","topic_featured_link_allowed":"Дозволити популярні посилання в цій категорії","delete":"Видалити категорію","create":"Нова категорія","create_long":"Створити категорію","save":"Зберегти категорію","slug":"Посилання на розділ","slug_placeholder":"(Опція) дефіси в url","creation_error":"Під час створення категорії трапилася помилка.","save_error":"Під час збереження категорії трапилася помилка.","name":"Назва категорії","description":"Опис","topic":"тема категорії","logo":"Логотип розділу","background_image":"Фонове зображення розділу","badge_colors":"Кольори значка","background_color":"Колір тла","foreground_color":"Колір тексту","name_placeholder":"Не більше одного-двох слів","color_placeholder":"Будь-який веб-колір","delete_confirm":"Ви впевнені, що хочете видалити цю категорію?","delete_error":"Під час видалення категорії трапилася помилка.","list":"List Categories","no_description":"Будь ласка, додайте опис для цього розділу.","change_in_category_topic":"Редагувати опис","already_used":"Цей колір вже використовується іншою категорією","security":"Безпека","special_warning":"Увага: даний розділ був встановлений та налаштування безпеки не можуть бути змінені. Якщо не хочете використовувати цей розділ, видаліть його замість зміни.","uncategorized_security_warning":"Ця категорія особлива. Він призначений для зберігання тем, які не мають категорії; у нього не може бути налаштувань безпеки.","uncategorized_general_warning":"Ця категорія особлива. Він використовується в якості категорії за замовчуванням для нових тем, для яких не обрана категорія. Якщо ви хочете запобігти таку поведінку та примусово вибрати категорію, вимкніть настройку тут\u003c/a\u003e. Якщо ви хочете змінити ім’я або опис, перейдіть до \u003ca href=\"%{customizeLink}\"\u003e Налаштувати / текстовий вміст\u003c/a\u003e.","pending_permission_change_alert":"Ви не додали %{group} в цю категорію; натисніть цю кнопку, щоб додати їх.","images":"Зображення","email_in":"Custom incoming email address:","email_in_allow_strangers":"Приймати листи від анонімних користувачів без облікових записів","email_in_disabled":"Створення нових тем через електронну пошту відключено в налаштуваннях сайту. Щоб дозволити створення нових тем через електронну пошту,","email_in_disabled_click":"активуйте налаштування \"email in\".","mailinglist_mirror":"Категорія відображає список розсилки","show_subcategory_list":"Показувати список підрозділів над списком тем в цьому розділі.","num_featured_topics":"Кількість тем на сторінці розділів","subcategory_num_featured_topics":"Кількість обраних тем на сторінці батьківської категорії:","all_topics_wiki":"Створення нових тем Wikis за замовчуванням","subcategory_list_style":"Стиль списку підрозділів:","sort_order":"Порядок сортування тем:","default_view":"Вид списку тем за умовчанням:","default_top_period":"Верхній період за замовчуванням:","allow_badges_label":"Дозволити нагороджувати значками у цій категорії","edit_permissions":"Редагувати дозволи","reviewable_by_group":"Крім персоналу, пости та прапори в цій категорії також можуть бути розглянуті:","review_group_name":"назва групи","require_topic_approval":"З них потребують схвалення модератором всіх нових тем","require_reply_approval":"З них потребують схвалення модератором всіх нових відповідей","this_year":"цього року","position":"Позиція на сторінці категорії:","default_position":"Default Position","position_disabled":"Розділи будуть показані в порядку активності. Щоб налаштувати порядок розділів,","position_disabled_click":"включите налаштування \"fixed category positions\".","minimum_required_tags":"Мінімальна кількість міток, необхідна у темі:","parent":"Батьківська категорія","num_auto_bump_daily":"Кількість відкритих тем для автоматичного підняття щодня:","navigate_to_first_post_after_read":"Перейдіть до першого повідомлення після прочитання тем","notifications":{"watching":{"title":"Слідкувати","description":"Спостерігати за всіма темами цього розділу. Повідомляти про кожне нове повідомленні в будь-який з часом та показувати лічильник нових відповідей."},"watching_first_post":{"title":"Слідкувати за першим дописом","description":"Ви будете повідомлені про нові теми в цій категорії, але не на відповіді в них."},"tracking":{"title":"Стежити","description":"Відстежувати всі теми цього розділу. Повідомляти якщо хтось згадає ваше @name або відповість вам, показувати лічильник нових відповідей."},"regular":{"title":"Нормальний","description":"Ви будете сповіщені, якщо хтось згадує ваше @ім'я чи відповідає вам."},"muted":{"title":"Ігноровані","description":"Не повідомляти про нові теми в цьому розділі та приховати їх з останніх."}},"search_priority":{"label":"Пріоритет Пошуку","options":{"normal":"Нормальний","ignore":"Ігнорувати","very_low":"Дуже низький","low":"Низький","high":"Високий","very_high":"Дуже високий"}},"sort_options":{"default":"типово","likes":"Вподобання","op_likes":"Кількість симпатій у першого повідомлення","views":"Перегляди","posts":"Дописи","activity":"Активність","posters":"Кількість учасників","category":"Категорія","created":"Створено","votes":"Голосів"},"sort_ascending":"По зростанню","sort_descending":"За зменшенням","subcategory_list_styles":{"rows":"Рядки","rows_with_featured_topics":"Рядки з обговорюваних тем","boxes":"Блоки","boxes_with_featured_topics":"Блоки з обговорюваних тем"},"settings_sections":{"general":"Основне","moderation":"Модерація","appearance":"Зовнішній вигляд","email":"Електронна пошта"}},"flagging":{"title":"Дякую за вашу допомогу в підтримці порядку!","action":"Поскаржитися на допис","take_action":"Вжити заходів","notify_action":"Повідомлення","official_warning":"Офіційне попередження","delete_spammer":"Видалити спамера","yes_delete_spammer":"Так, видалити спамера","ip_address_missing":"(не доступно)","hidden_email_address":"(приховано)","submit_tooltip":"Надіслати приватну скаргу","take_action_tooltip":"Зімітувати досягнення порогу кількості скарг, не чекаючи їх від спільноти","cant":"Даруйте, зараз Ви не можете поскаржитися на цей допис.","notify_staff":"Повідомити модератора приватно","formatted_name":{"off_topic":"Це не по темі","inappropriate":"Це не прийнятно","spam":"Це спам"},"custom_placeholder_notify_user":"Будьте точні, конструктивні та доброзичливі.","custom_placeholder_notify_moderators":"Поясніть суть проблеми: на що нам слід звернути увагу. Надайте відповідні посилання, якщо це можливо.","custom_message":{"at_least":{"one":"Введіть хоча б%{count} символ","few":"Введіть хоча б {{count}} символу","many":"Введіть хоча б {{count}} символів","other":"Введіть хоча б {{count}} символів"},"more":{"one":"Ще %{count} символ...","few":"Ще хоча б {{count}} символу...","many":"Ще хоча б {{count}} символів...","other":"Ще хоча б {{count}} символів..."},"left":{"one":"Залишилося не більше %{count} символу","few":"Залишилося не більше {{count}} символів","many":"Залишилося не більше {{count}} символів","other":"Залишилося не більше {{count}} символів"}}},"flagging_topic":{"title":"Дякую за допомогу в підтримці порядку!","action":"Поскаржитись на тему","notify_action":"Повідомлення"},"topic_map":{"title":"Підсумок теми","participants_title":"Часті автори","links_title":"Популярні посилання","links_shown":"показати більше посилань...","clicks":{"one":"%{count} клік","few":"%{count} кліка","many":"%{count} кліків","other":"%{count} кліків"}},"post_links":{"about":"покази","title":{"one":"ще %{count}","few":"ще %{count}","many":"ще %{count}","other":"ще %{count}"}},"topic_statuses":{"warning":{"help":"Це офіційне попередження."},"bookmarked":{"help":"Вы додали тему в закладки "},"locked":{"help":"цю тему закрито; нові відповіді більше не приймаються"},"archived":{"help":"цю тему заархівовано; вона заморожена і її не можна змінити"},"locked_and_archived":{"help":"Тема закрита та заархівувати; в ній більше не можна відповідати вона більше не може бути змінена"},"unpinned":{"title":"Не закріплені","help":"Ця тема для вас відкріплений; вона буде відображатися в звичайному порядку"},"pinned_globally":{"title":"закріплена глобально","help":"Ця тема закріплена глобально; вона буде відображатися вгорі як на головній, так та в своєму розділі"},"pinned":{"title":"Закріплені","help":"Ця тема для вас закріплена; вона буде показана вгорі свого розділу"},"unlisted":{"help":"Тема виключена з усіх списків тем та доступна тільки за прямим посиланням"},"personal_message":{"title":"Ця тема є особистим повідомленням","help":"Ця тема є особистим повідомленням"}},"posts":"Дописи","posts_long":"тема містить {{number}} дописів","original_post":"Перший допис","views":"Перегляди","views_lowercase":{"one":"перегляд","few":"переглядів","many":"переглядів","other":"переглядів"},"replies":"Відповіді","views_long":{"one":"тема переглянута%{count} раз","few":"тема переглянута {{number}} рази","many":"тема переглянута {{number}} раз","other":"тема переглянута {{number}} раз"},"activity":"Активність","likes":"Вподобання","likes_lowercase":{"one":"симпатія","few":"симпатій","many":"симпатій","other":"симпатій"},"likes_long":"в цій темі {{number}} вподобань","users":"Користувачі","users_lowercase":{"one":"користувач","few":"користувача","many":"користувача","other":"користувача"},"category_title":"Категорія","history":"Історія","changed_by":"{{author}}","raw_email":{"title":"Вхідне повідомлення","not_available":"Не доступно!"},"categories_list":"Список категорій","filters":{"with_topics":"%{filter} теми","with_category":"%{filter}%{category} теми","latest":{"title":"Останні","title_with_count":{"one":"Останні (%{count})","few":"Останні ({{count}})","many":"Останні ({{count}})","other":"Останні ({{count}})"},"help":"теми з найсвіжішими дописами"},"read":{"title":"Прочитані","help":"теми, які Ви прочитали, у порядку, в якому Ви їх читали востаннє"},"categories":{"title":"Категорії","title_in":"Категорія - {{categoryName}}","help":"всі теми, згруповані за категоріями"},"unread":{"title":"Непрочитані","title_with_count":{"one":"Непрочитані ({{count}})","few":"Непрочитані ({{count}})","many":"Непрочитані ({{count}})","other":"Непрочитані ({{count}})"},"help":"спостерігаються або відслідковують теми з непрочитаними повідомленнями","lower_title_with_count":{"one":"{{count}} непрочитана","few":"{{count}} непрочитаних","many":"{{count}} непрочитаних","other":"{{count}} непрочитаних"}},"new":{"lower_title_with_count":{"one":"{{count}} нова","few":"{{count}} нових","many":"{{count}} нових","other":"{{count}} нових"},"lower_title":"new","title":"Новий","title_with_count":{"one":"Нові ({{count}})","few":"Нові ({{count}})","many":"Нові ({{count}})","other":"Нові ({{count}})"},"help":"теми, створені за останні кілька днів"},"posted":{"title":"Мої дописи","help":"теми, в які Ви дописували"},"bookmarks":{"title":"Закладки","help":"теми, які ви додали в закладки"},"category":{"title":"{{categoryName}}","title_with_count":{"one":"{{categoryName}} ({{count}})","few":"{{categoryName}} ({{count}})","many":"{{categoryName}} ({{count}})","other":"{{categoryName}} ({{count}})"},"help":"Останні теми в категорії {{categoryName}}"},"top":{"title":"Top","help":"Найактивніші теми за останній рік, місяць, квартал, тиждень або день","all":{"title":"Весь час"},"yearly":{"title":"Щорічно"},"quarterly":{"title":"Щоквартала"},"monthly":{"title":"Щомісяця"},"weekly":{"title":"Щотижня"},"daily":{"title":"Щодня"},"all_time":"Весь час","this_year":"Рік","this_quarter":"Квартал","this_month":"Місяць","this_week":"Тиждень","today":"Today","other_periods":"показати найбільш обговорювані"},"votes":{"title":"Голосів","help":"теми з найбільшою кількістю голосів"}},"browser_update":"На жаль, \u003ca href=\"https://www.discourse.org/faq/#browser\"\u003eваш браузер застарів та не підтримується цим сайтом\u003c/a\u003e. Будь ласка, \u003ca href=\"https://browsehappy.com\"\u003eпоновіть браузер\u003c/a\u003e.","permission_types":{"full":"Створювати / Відповідати / Бачити","create_post":"Відповідати / Бачити","readonly":"Бачити"},"lightbox":{"download":"завантажити","previous":"Попередній (клавіша зі стрілкою вліво)","next":"Наступний (клавіша зі стрілкою вправо)","counter":"%curr% з %total%","close":"Закрити (Esc)","content_load_error":"\u003ca href=\"%url%\"\u003eВміст\u003c/a\u003e не вдалося завантажити.","image_load_error":"\u003ca href=\"%url%\"\u003eЗображення\u003c/a\u003e не вдалося завантажити."},"keyboard_shortcuts_help":{"shortcut_key_delimiter_comma":", ","shortcut_key_delimiter_plus":"+","shortcut_delimiter_or":"%{shortcut1} або %{shortcut2}","shortcut_delimiter_slash":"%{shortcut1}/%{shortcut2}","shortcut_delimiter_space":"%{shortcut1} %{shortcut2}","title":"Поєднання клавіш","jump_to":{"title":"Перейти до","home":"%{shortcut} Головна","latest":"%{shortcut} Останні","new":"%{shortcut} Нові","unread":"%{shortcut} Непрочитані","categories":"%{shortcut} Категорії","top":"%{shortcut} Обговорювані","bookmarks":"%{shortcut} Закладки","profile":"%{shortcut} Профіль","messages":"%{shortcut} Особисті повідомлення","drafts":"%{shortcut} Чернетки"},"navigation":{"title":"Навігація","jump":"%{shortcut} Перейти до повідомлення №","back":"%{shortcut} Назад","up_down":"%{shortcut} Рухати курсор виділення теми \u0026uarr; \u0026darr;","open":"%{shortcut} Відкрити обрану тему","next_prev":"%{shortcut} Наступна/попередня секція","go_to_unread_post":"%{shortcut} Перейти до першого непрочитаного повідомлення"},"application":{"title":"Застосунок","create":"%{shortcut} Створити нову тему","notifications":"%{shortcut} Відкрити сповіщення","hamburger_menu":"%{shortcut} Відкрити меню гамбургер","user_profile_menu":"%{shortcut} Відкрити меню профілю","show_incoming_updated_topics":"%{shortcut} Показати оновлені теми","search":"%{shortcut} Пошук","help":"%{shortcut} Показати поєднання клавіш","dismiss_new_posts":"%{shortcut} Відкласти нові повідомлення","dismiss_topics":"%{shortcut} Відкласти теми","log_out":"%{shortcut} Вийти"},"composing":{"title":"Редагування","return":"%{shortcut} Повернутися в редактор","fullscreen":"%{shortcut} Повноекранний редактор"},"actions":{"title":"Дії","bookmark_topic":"%{shortcut} Додати/видалити з заклодок","pin_unpin_topic":"%{shortcut} Закріпити/Відкріпити теми","share_topic":"%{shortcut} Поділитися темою","share_post":"%{shortcut} Поширити допис","reply_as_new_topic":"%{shortcut} Відповісти в новій пов’язаній темі","reply_topic":"%{shortcut} Відповісти в темі","reply_post":"%{shortcut} Відповісти на допис","quote_post":"%{shortcut} Цитувати допис","like":"%{shortcut} Вподобати допис","flag":"%{shortcut} Поскаржитися на допис","bookmark":"%{shortcut} Лишити закладку в дописі","edit":"%{shortcut} Редагувати допис","delete":"%{shortcut} Видалити допис","mark_muted":"%{shortcut} Ігнорувати сповіщення з теми","mark_regular":"%{shortcut} Стандартні повідомлення в темі (по-замовчуванню)","mark_tracking":"%{shortcut} Стежити за темою","mark_watching":"%{shortcut} Спостерігати за темою","print":"%{shortcut} Друкувати тему","defer":"%{shortcut} Відкласти тему","topic_admin_actions":"%{shortcut} Відкрити дії адміністратора теми"}},"badges":{"earned_n_times":{"one":"Заробив цю нагороду %{count} раз","few":"Заробили цю нагороду %{count} раз","many":"Заробили цю нагороду %{count} раз","other":"Заробили цю нагороду %{count} раз"},"granted_on":"Видана %{date}","others_count":"Інші з цією нагородою (%{count})","title":"Значки","allow_title":"Ви можете использовать эту нагороду в качестве титула.","multiple_grant":"Ви можете получить её несколько раз","badge_count":{"one":"%{count} нагорода","few":"%{count} нагорода","many":"%{count} нагорода","other":"%{count} нагорода"},"more_badges":{"one":"ще + %{count}","few":"+ ще %{count}","many":"+ ще %{count}","other":"+ ще %{count}"},"granted":{"one":"видано %{count}","few":"видано %{count}","many":"видано %{count}","other":"видано %{count}"},"select_badge_for_title":"Оберіть значок, що буде вашим званням","none":"(немає)","successfully_granted":"Нагорода %{badge} успішно присвоєна %{username}","badge_grouping":{"getting_started":{"name":"Початок роботи"},"community":{"name":"Спільнота"},"trust_level":{"name":"Рівень довіри"},"other":{"name":"Інше"},"posting":{"name":"Опублікування"}}},"tagging":{"all_tags":"Усі мітки","other_tags":"Інші мітки","selector_all_tags":"усі мітки","selector_no_tags":"без міток","changed":"мітки змінилися:","tags":"Мітки","choose_for_topic":"необов'язкові мітки","info":"Інформація","default_info":"Цей тег не обмежений розділами та не має синонімів.","category_restricted":"Цей тег обмежений категоріями, на які ви не маєте дозволу на доступ.","synonyms":"Синоніми","synonyms_description":"Коли будуть використані наступні теги, вони будуть замінені на \u003cb\u003e%{base_tag_name}\u003c/b\u003e .","tag_groups_info":{"one":"Цей тег належить до групи \u0026quot;{{tag_groups}}\u0026quot;.","few":"Цей тег належить до цих груп: {{tag_groups}}.","many":"Цей тег належить до цих груп: {{tag_groups}}.","other":"Цей тег належить до цих груп: {{tag_groups}}."},"category_restrictions":{"one":"Його можна використовувати лише в цій категорії:","few":"Його можна використовувати лише в таких категоріях:","many":"Його можна використовувати лише в таких категоріях:","other":"Його можна використовувати лише в таких розділах:"},"edit_synonyms":"Управління синонімами","add_synonyms_label":"Додайте синоніми:","add_synonyms":"Додати","add_synonyms_explanation":{"one":"Будь-яке місце, яке зараз використовує цей тег, буде змінено на використання \u003cb\u003e%{tag_name}\u003c/b\u003e . Ви впевнені, що хочете внести цю зміну?","few":"Будь-яке місце, яке в даний час використовує ці теги, буде змінено на використання \u003cb\u003e%{tag_name}\u003c/b\u003e . Ви впевнені, що хочете внести цю зміну?","many":"Будь-яке місце, яке в даний час використовує ці теги, буде змінено на використання \u003cb\u003e%{tag_name}\u003c/b\u003e . Ви впевнені, що хочете внести цю зміну?","other":"Будь-яке місце, яке в даний час використовує ці теги, буде змінено на використання \u003cb\u003e%{tag_name}\u003c/b\u003e . Ви впевнені, що хочете внести цю зміну?"},"add_synonyms_failed":"Наступні теги не можна додати як синоніми: \u003cb\u003e%{tag_names}\u003c/b\u003e. Переконайтесь, що вони не мають синонімів та не є синонімами іншого тегу.","remove_synonym":"Видалити синонім","delete_synonym_confirm":"Ви впевнені, що хочете видалити синонім \u0026quot;%{tag_name}\u0026quot;?","delete_tag":"Вилучити мітку","delete_confirm":{"one":"Ви впевнені, що хочете вилучити цю мітку і прибрати її з %{count} теми, де вона використана?","few":"Ви впевнені, що хочете вилучити цю мітку і прибрати її з {{count}} тем, де вона використана?","many":"Ви впевнені, що хочете вилучити цю мітку і прибрати її з {{count}} тем, де вона використана?","other":"Ви впевнені, що хочете вилучити цю мітку і прибрати її з {{count}} тем, де вона використана?"},"delete_confirm_no_topics":"Ви впевнені, що хочете вилучити цю мітку?","delete_confirm_synonyms":{"one":"Його синонім також буде видалено.","few":"Синоніми {{count}} також будуть видалені.","many":"Синоніми {{count}} також будуть видалені.","other":"Синоніми {{count}} також будуть видалені."},"rename_tag":"Перейменувати мітку","rename_instructions":"Виберіть нову назву для мітки:","sort_by":"Сортувати за:","sort_by_count":"Кількість","sort_by_name":"ім'я","manage_groups":"Керувати групами міток","manage_groups_description":"Визначити групи для організації міток","upload":"Завантажити мітки","upload_description":"Завантажити csv-файл, щоб масово створити мітки","upload_instructions":"По одній у рядку, можна з групою міток у форматі 'назва_мітки,група_міток'.","upload_successful":"Мітки завантажено успішно","delete_unused_confirmation":{"one":"%{count} мітку буде вилучено: %{tags}","few":"%{count} мітки буде вилучено: %{tags}","many":"%{count} міток буде вилучено: %{tags}","other":"%{count} міток буде вилучено: %{tags}"},"delete_unused_confirmation_more_tags":{"one":"%{tags} і ще %{count} ","few":"%{tags} і ще %{count} ","many":"%{tags} і ще %{count} ","other":"%{tags} і ще %{count}"},"delete_unused":"Вилучити невикористовувані мітки","delete_unused_description":"Вилучити усі мітки, які не прикріплені до жодної теми чи особистих повідомлень","cancel_delete_unused":"Скасувати","filters":{"without_category":"%{filter} %{tag} тем","with_category":"%{filter} %{tag} тем у %{category}","untagged_without_category":"%{filter} непозначених тем","untagged_with_category":"%{filter} непозначених тем у %{category}"},"notifications":{"watching":{"title":"Слідкувати","description":"Ви автоматично слідкуватимете за всіма темами з цією міткою. Ви отримуватимете сповіщення про всі нові дописи і теми, а поруч з темою також показуватиметься кількість непрочитаних і нових дописів."},"watching_first_post":{"title":"Слідкувати за першим дописом","description":"Ви отримуватимете сповіщення про нові теми з цією міткою, але не відповіді до тем."},"tracking":{"title":"Стежити","description":"Ви будете автоматично стежити за всіма темами з цією міткою. Поруч з темою показуватиметься кількість непрочитаних і нових дописів."},"regular":{"title":"Звичайний","description":"Повідомляти, тільки якщо хтось згадає мене по @псевдоніму, або відповість на моє повідомлення."},"muted":{"title":"Ігнорувати","description":"Ви не будете отримувати жодних сповіщень про нові теми з цією міткою, і вони не з'являтимуться у вкладці Непрочитані."}},"groups":{"title":"Групи міток","about":"Додавайте мітки до груп, щоб легше ними керувати.","new":"Нова група","tags_label":"Мітки у цій групі:","tags_placeholder":"мітки","parent_tag_label":"Батьківська мітка:","parent_tag_placeholder":"Опціонально","parent_tag_description":"Мітки з цієї групи не можуть бути використані, якщо немає батьківської мітки.","one_per_topic_label":"Обмежити до однієї мітки з цієї групи на тему","new_name":"Нова група міток","name_placeholder":"Назва групи тегів","save":"Зберегти","delete":"Видалити","confirm_delete":"Ви впевнені, що хочете вилучити цю групу міток?","everyone_can_use":"Мітки може використовувати будь-хто","usable_only_by_staff":"Мітки видимі для всіх, але лише працівники можуть їх використовувати","visible_only_to_staff":"Мітки видимі лише персоналу"},"topics":{"none":{"unread":"У Вас немає непрочитаних тем.","new":"У Вас немає нових тем.","read":"Ви ще не прочитали жодної теми.","posted":"Ви ще не дописували в жодну тему.","latest":"Немає останніх тем.","bookmarks":"У вас поки немає тем в закладках.","top":"Топових тем немає."},"bottom":{"latest":"Більше немає останніх тем.","posted":"Більше немає опублікованих тем.","read":"Більше немає прочитаних тем.","new":"Більше немає нових тем.","unread":"Більше немає непрочитаних тем.","top":"Топових тем більше немає.","bookmarks":"Більше немає тем в закладках."}}},"invite":{"custom_message":"Зробити запрошення трохи більш особистим, написавши \u003ca href\u003e повідомлення користувачеві\u003c/a\u003e.","custom_message_placeholder":"Напишіть сюди ваше особисте повідомлення","custom_message_template_forum":"Вітання. Подумав, що тобі буде цікаво зареєструватися на цьому форумі!","custom_message_template_topic":"Вітання! Подумав, що тебе може зацікавити ця тема!"},"forced_anonymous":"Через надмірне навантаження, це тимчасово показується всім, як якщо б користувач вийшов з системи.","safe_mode":{"enabled":"Включено безпечний режим, щоб вийти з безпечного режиму, закрийте поточне вікно браузера"},"poll":{"voters":{"one":"виборця","few":"виборців","many":"виборців","other":"проголосували"},"total_votes":{"one":"голос","few":"голосів","many":"голоси","other":"голоси"},"average_rating":"Середній рейтинг: \u003cstrong\u003e%{average}\u003c/strong\u003e.","public":{"title":"Голоси \u003cstrong\u003eпублічні\u003c/strong\u003e ."},"results":{"vote":{"title":"Результати будуть показані при \u003cstrong\u003eголосуванні\u003c/strong\u003e ."},"closed":{"title":"Результати будуть показані після \u003cstrong\u003eзакриття\u003c/strong\u003e ."},"staff":{"title":"Результати показуються лише \u003cstrong\u003eспівробітникам\u003c/strong\u003e ."}},"multiple":{"help":{"at_least_min_options":{"one":"Виберіть хоча б \u003cstrong\u003e%{count}\u003c/strong\u003e варіант","few":"Виберіть хоча б \u003cstrong\u003e%{count}\u003c/strong\u003e варіантів","many":"Виберіть хоча б \u003cstrong\u003e%{count}\u003c/strong\u003e варіанти","other":"Виберіть хоча б \u003cstrong\u003e%{count}\u003c/strong\u003e варіанти"},"up_to_max_options":{"one":"Виберіть варіант \u003cstrong\u003e%{count}\u003c/strong\u003e","few":"Виберіть до \u003cstrong\u003e%{count}\u003c/strong\u003e варіантів","many":"Виберіть до \u003cstrong\u003e%{count}\u003c/strong\u003e варіантів","other":"Виберіть до \u003cstrong\u003e%{count}\u003c/strong\u003e варіантів"},"x_options":{"one":"Виберіть варіант \u003cstrong\u003e%{count}\u003c/strong\u003e","few":"Виберіть параметри \u003cstrong\u003e%{count}\u003c/strong\u003e","many":"Виберіть параметри \u003cstrong\u003e%{count}\u003c/strong\u003e","other":"Виберіть параметри \u003cstrong\u003e%{count}\u003c/strong\u003e"},"between_min_and_max_options":"Виберіть параметри від\u003cstrong\u003e%{min}\u003c/strong\u003e до %{max}\u003c/strong\u003e"}},"cast-votes":{"title":"Проголосуйте","label":"Проголосувати!"},"show-results":{"title":"Показати результати опитування","label":"Показати результати"},"hide-results":{"title":"Назад до своїх голосів","label":"Показати голосування"},"group-results":{"title":"Групувати голоси за полем користувача","label":"Показати відбивку"},"ungroup-results":{"title":"Об’єднайте всі голоси","label":"Сховати відбивку"},"export-results":{"title":"Експорт результатів опитування","label":"Експорт"},"open":{"title":"Відкрити опитування","label":"Відкрити","confirm":"Ви впевнені, що хочете відкрити це опитування?"},"close":{"title":"Закрити опитування","label":"Закрити","confirm":"Ви впевнені, що хочете закрити це опитування?"},"automatic_close":{"closes_in":"Закривається в \u003cstrong\u003e%{timeLeft}\u003c/strong\u003e .","age":"Закрито \u003cstrong\u003e%{age}\u003c/strong\u003e"},"error_while_toggling_status":"На жаль, виникла помилка зміни статусу цього опитування.","error_while_casting_votes":"На жаль, сталася помилка під час голосування.","error_while_fetching_voters":"На жаль, під час відображення тих, хто проголосував, сталася помилка.","error_while_exporting_results":"На жаль, сталася помилка експорту результатів опитування.","ui_builder":{"title":"Створити опитування","insert":"Вставити опитування","help":{"invalid_values":"Мінімальне значення має бути меншим, ніж максимальне.","min_step_value":"Мінімальне значення кроку 1"},"poll_type":{"label":"Тип","regular":"Єдиний вибір","multiple":"Широкий вибір","number":"Рейтинг в цифрах"},"poll_result":{"label":"Результати","always":"Завжди видно","vote":"На голосування","closed":"Коли закрито","staff":"Для персоналу тільки"},"poll_chart_type":{"label":"Тип діаграми"},"poll_config":{"max":"Макс","min":"Мін","step":"Крок"},"poll_public":{"label":"Покажіть, хто проголосував"},"poll_options":{"label":"Введіть один варіант опитування на рядок"},"automatic_close":{"label":"Автоматично закрити опитування"}}},"discourse_narrative_bot":{"welcome_post_type":{"new_user_track":"Переглянути посібник для нових користувачів","welcome_message":"Надіслати всім новим користувачам - вітальне повідомлення з швидким переходом до посібника користувача"}},"discourse_local_dates":{"relative_dates":{"today":"Сьогодні %{time}","tomorrow":"Завтра %{time}","yesterday":"Вчора %{time}","countdown":{"passed":"дата минула"}},"title":"Вставити дату / час","create":{"form":{"insert":"Вставити","advanced_mode":"Розширений режим","simple_mode":"Простий режим","format_description":"Формат, який використовується для відображення дати користувачеві. Використовуйте \"\\T\\Z\", щоб відобразити часовий пояс користувача словами (Європа/Париж)","timezones_title":"Часові пояси показати","timezones_description":"Часові пояси будуть використовуватися для відображення дат у попередньому та резервному режимі.","recurring_title":"Повторення","recurring_description":"Визначте повторення події. Ви можете вручну редагувати повторюваний параметр, створений формою, і скористатися однією з таких клавіш: роки, квартали, місяці, тижні, дні, години, хвилини, секунди, мілісекунди.","recurring_none":"Без повторів","invalid_date":"Недійсна дата, переконайтесь, що дата та час є правильними","date_title":"Дата","time_title":"Час","format_title":"Формат дати","timezone":"Часовий пояс","until":"Поки...","recurring":{"every_day":"Щодня","every_week":"Щотижня","every_two_weeks":"Кожні два тижні","every_month":"Щомісяця","every_two_months":"Кожні два місяці","every_three_months":"Кожні три місяці","every_six_months":"Кожні півроку","every_year":"Щороку"}}}},"details":{"title":"Сховати деталі"},"presence":{"replying":"відповідаючи","editing":"редагуючи","replying_to_topic":{"one":"відповідаючи","few":"відповідаючи","many":"відповідаючи","other":"відповідаючи"}},"voting":{"title":"Голосування","reached_limit":"У вас немає голосів, видаліть існуюче голосування!","list_votes":"Список своїх голосів","votes_nav_help":"теми з найбільшою кількістю голосів","voted":"Ви проголосували в цій темі","allow_topic_voting":"Дозволити користувачам голосувати в темах цієї категорії","vote_title":"Проголосувати","vote_title_plural":"Голосів","voted_title":"Проголосували","voting_closed_title":"Закриті","voting_limit":"Обмеження","votes_left":{"one":"У вас залишилось {{count}} голосів, побачите \u003ca href='{{path}}'\u003eсвої голоси\u003c/a\u003e .","few":"У вас залишилось {{count}} голосів, дивіться \u003ca href='{{path}}'\u003eваші голоси\u003c/a\u003e .","many":"У вас залишилось {{count}} голосів, дивіться \u003ca href='{{path}}'\u003eваші голоси\u003c/a\u003e .","other":"У вас залишилось {{count}} голосів, дивіться \u003ca href='{{path}}'\u003eваші голоси\u003c/a\u003e ."},"votes":{"one":"{{count}} голос","few":"{{count}} голосів","many":"{{count}} голосів","other":"{{count}} голосів"},"anonymous_button":{"one":"Голосувати","few":"Голосів","many":"Голосів","other":"Голосів"},"remove_vote":"Видалити голосування"},"adplugin":{"advertisement_label":"РЕКЛАМА"},"docker":{"upgrade":"Ваш інсталятор Discourse застарів.","perform_upgrade":"Натисніть тут для оновлення."}}},"zh_CN":{"js":{"dates":{"long_no_year":"M[月]D[日] HH:mm"},"bookmarked":{"help":{"unbookmark_with_reminder":"点击以移除该主题上的所有收藏和提醒。你在该主题中设定了一个于%{reminder_at}的提醒。"}},"bookmarks":{"created_with_reminder":"你已经收藏该帖并且设定了一个于%{date}的提醒","created_with_at_desktop_reminder":"你所收藏的此帖将会在你下次使用桌面设备时被提醒。","delete":"删除收藏","confirm_delete":"你确定要删除该收藏吗？你所设置的提醒也会被一并删除。","invalid_custom_datetime":"你所提供的日期和时间无效，请重试。","list_permission_denied":"你没有权限查看该用户的收藏。","reminders":{"next_business_day":"下一个工作日","start_of_next_business_week":"下周一","last_custom":"最近","none":"无需提醒","today_with_time":"今天%{time}","tomorrow_with_time":"明天%{time}","at_time":"于%{date_time}","existing_reminder":"你为该收藏所设定的提醒将被发出"}},"directory":{"last_updated":"最近更新："},"user":{"use_current_timezone":"使用现在的时区","staff_counters":{"rejected_posts":"被驳回的帖子"},"second_factor":{"totp":{"name_and_code_required_error":"你必须提供你的身份验证器应用的名称和代码。"},"security_key":{"name_required_error":"你必须提供安全密钥的名称。"}},"change_avatar":{"gravatar":"\u003ca href='//{{gravatarBaseUrl}}{{gravatarLoginUrl}}' target='_blank'\u003e{{gravatarName}}\u003c/a\u003e，基于","gravatar_title":"在{{gravatarName}}网站修改你的头像","gravatar_failed":"我们无法找到此电子邮件的{{gravatarName}}。","refresh_gravatar_title":"刷新你的{{gravatarName}}"},"invite_code":{"title":"邀请码","instructions":"账户注册需要邀请码"}},"modal":{"dismiss_error":"忽略错误"},"notifications":{"tooltip":{"high_priority":{"other":"%{count}个未读的高优先级通知"}},"titles":{"bookmark_reminder":"收藏提醒","bookmark_reminder_with_name":"收藏提醒 - %{name}"}},"topic":{"topic_status_update":{"num_of_days":"天数"},"auto_delete_replies":{"title":"自动删除回复"},"status_update_notice":{"auto_delete_replies":"此主题的回复会在%{duration}后自动删除。"},"publish_page":{"publish":"出版","description":"当一个主题被出版为一个页面时，其链接是共享的，并且会以自定义的样式显示。","slug":"Slug","publish_url":"你的页面已出版于：","topic_published":"你的主题已出版于：","preview_url":"你的页面将出版于：","invalid_slug":"抱歉，您不能出版此页面。","unpublish":"取消出版","unpublished":"你的页面已经取消出版并且不再可用。","publishing_settings":"出版设置"},"change_owner":{"instructions_without_old_user":{"other":"请为此{{count}}个帖子选择一个新的拥有者。"}}},"post":{"bookmarks":{"edit":"编辑收藏","name_placeholder":"这个收藏是做什么用的？","set_reminder":"提醒我","actions":{"edit_bookmark":{"name":"编辑收藏","description":"编辑收藏名称或修改提醒的日期和时间"}}}},"keyboard_shortcuts_help":{"bookmarks":{"title":"收藏","enter":"%{shortcut} 保存并关闭","later_today":"%{shortcut} 今天晚些时候","later_this_week":"%{shortcut} 本周的晚些时候","tomorrow":"%{shortcut} 明天","next_week":"%{shortcut} 下周","next_month":"%{shortcut} 下个月","next_business_week":"%{shortcut} 下周开始","next_business_day":"%{shortcut} 下个工作日","custom":"%{shortcut} 自定义日期和时间","none":"%{shortcut} 没有提醒","delete":"%{shortcut} 删除收藏"},"search_menu":{"title":"搜索菜单","prev_next":"%{shortcut}上下移动所选内容","insert_url":"%{shortcut}将选定内容插入到打开的编辑器"}},"poll":{"results":{"groups":{"title":"你需要成为 %{groups} 的一员才能投票。"}},"ui_builder":{"help":{"options_count":"至少输入1个选项"},"poll_groups":{"label":"允许的群组"}}}}},"en":{"js":{"user":{"change_password":{"emoji":"lock emoji"}},"local_time":"Local Time","email_login":{"emoji":"lock emoji"},"invites":{"emoji":"envelope emoji"},"notifications":{"tooltip":{"high_priority":{"one":"%{count} unread high priority notification"}}},"topic":{"publish_page":{"title":"Page Publishing"},"change_owner":{"instructions_without_old_user":{"one":"Please choose a new owner for the post"}}},"post":{"controls":{"publish_page":"Page Publishing"}},"discourse_internet_explorer":{"deprecation_warning":"This site will soon remove support for Internet Explorer 11 - please update your browser"},"poll":{"ui_builder":{"poll_chart_type":{"bar":"Bar","pie":"Pie"}}},"admin":{"logs":{"staff_actions":{"actions":{"discourse_upgrade":"Upgrade to the Latest Version"}}}},"docker":{"link_to_upgrade":"Perform upgrades here."}}}};
I18n.locale = 'uk';
I18n.pluralizationRules.uk = MessageFormat.locale.uk;
//! moment.js

;(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    global.moment = factory()
}(this, (function () { 'use strict';

    var hookCallback;

    function hooks () {
        return hookCallback.apply(null, arguments);
    }

    // This is done to register the method called with moment()
    // without creating circular dependencies.
    function setHookCallback (callback) {
        hookCallback = callback;
    }

    function isArray(input) {
        return input instanceof Array || Object.prototype.toString.call(input) === '[object Array]';
    }

    function isObject(input) {
        // IE8 will treat undefined and null as object if it wasn't for
        // input != null
        return input != null && Object.prototype.toString.call(input) === '[object Object]';
    }

    function isObjectEmpty(obj) {
        if (Object.getOwnPropertyNames) {
            return (Object.getOwnPropertyNames(obj).length === 0);
        } else {
            var k;
            for (k in obj) {
                if (obj.hasOwnProperty(k)) {
                    return false;
                }
            }
            return true;
        }
    }

    function isUndefined(input) {
        return input === void 0;
    }

    function isNumber(input) {
        return typeof input === 'number' || Object.prototype.toString.call(input) === '[object Number]';
    }

    function isDate(input) {
        return input instanceof Date || Object.prototype.toString.call(input) === '[object Date]';
    }

    function map(arr, fn) {
        var res = [], i;
        for (i = 0; i < arr.length; ++i) {
            res.push(fn(arr[i], i));
        }
        return res;
    }

    function hasOwnProp(a, b) {
        return Object.prototype.hasOwnProperty.call(a, b);
    }

    function extend(a, b) {
        for (var i in b) {
            if (hasOwnProp(b, i)) {
                a[i] = b[i];
            }
        }

        if (hasOwnProp(b, 'toString')) {
            a.toString = b.toString;
        }

        if (hasOwnProp(b, 'valueOf')) {
            a.valueOf = b.valueOf;
        }

        return a;
    }

    function createUTC (input, format, locale, strict) {
        return createLocalOrUTC(input, format, locale, strict, true).utc();
    }

    function defaultParsingFlags() {
        // We need to deep clone this object.
        return {
            empty           : false,
            unusedTokens    : [],
            unusedInput     : [],
            overflow        : -2,
            charsLeftOver   : 0,
            nullInput       : false,
            invalidMonth    : null,
            invalidFormat   : false,
            userInvalidated : false,
            iso             : false,
            parsedDateParts : [],
            meridiem        : null,
            rfc2822         : false,
            weekdayMismatch : false
        };
    }

    function getParsingFlags(m) {
        if (m._pf == null) {
            m._pf = defaultParsingFlags();
        }
        return m._pf;
    }

    var some;
    if (Array.prototype.some) {
        some = Array.prototype.some;
    } else {
        some = function (fun) {
            var t = Object(this);
            var len = t.length >>> 0;

            for (var i = 0; i < len; i++) {
                if (i in t && fun.call(this, t[i], i, t)) {
                    return true;
                }
            }

            return false;
        };
    }

    function isValid(m) {
        if (m._isValid == null) {
            var flags = getParsingFlags(m);
            var parsedParts = some.call(flags.parsedDateParts, function (i) {
                return i != null;
            });
            var isNowValid = !isNaN(m._d.getTime()) &&
                flags.overflow < 0 &&
                !flags.empty &&
                !flags.invalidMonth &&
                !flags.invalidWeekday &&
                !flags.weekdayMismatch &&
                !flags.nullInput &&
                !flags.invalidFormat &&
                !flags.userInvalidated &&
                (!flags.meridiem || (flags.meridiem && parsedParts));

            if (m._strict) {
                isNowValid = isNowValid &&
                    flags.charsLeftOver === 0 &&
                    flags.unusedTokens.length === 0 &&
                    flags.bigHour === undefined;
            }

            if (Object.isFrozen == null || !Object.isFrozen(m)) {
                m._isValid = isNowValid;
            }
            else {
                return isNowValid;
            }
        }
        return m._isValid;
    }

    function createInvalid (flags) {
        var m = createUTC(NaN);
        if (flags != null) {
            extend(getParsingFlags(m), flags);
        }
        else {
            getParsingFlags(m).userInvalidated = true;
        }

        return m;
    }

    // Plugins that add properties should also add the key here (null value),
    // so we can properly clone ourselves.
    var momentProperties = hooks.momentProperties = [];

    function copyConfig(to, from) {
        var i, prop, val;

        if (!isUndefined(from._isAMomentObject)) {
            to._isAMomentObject = from._isAMomentObject;
        }
        if (!isUndefined(from._i)) {
            to._i = from._i;
        }
        if (!isUndefined(from._f)) {
            to._f = from._f;
        }
        if (!isUndefined(from._l)) {
            to._l = from._l;
        }
        if (!isUndefined(from._strict)) {
            to._strict = from._strict;
        }
        if (!isUndefined(from._tzm)) {
            to._tzm = from._tzm;
        }
        if (!isUndefined(from._isUTC)) {
            to._isUTC = from._isUTC;
        }
        if (!isUndefined(from._offset)) {
            to._offset = from._offset;
        }
        if (!isUndefined(from._pf)) {
            to._pf = getParsingFlags(from);
        }
        if (!isUndefined(from._locale)) {
            to._locale = from._locale;
        }

        if (momentProperties.length > 0) {
            for (i = 0; i < momentProperties.length; i++) {
                prop = momentProperties[i];
                val = from[prop];
                if (!isUndefined(val)) {
                    to[prop] = val;
                }
            }
        }

        return to;
    }

    var updateInProgress = false;

    // Moment prototype object
    function Moment(config) {
        copyConfig(this, config);
        this._d = new Date(config._d != null ? config._d.getTime() : NaN);
        if (!this.isValid()) {
            this._d = new Date(NaN);
        }
        // Prevent infinite loop in case updateOffset creates new moment
        // objects.
        if (updateInProgress === false) {
            updateInProgress = true;
            hooks.updateOffset(this);
            updateInProgress = false;
        }
    }

    function isMoment (obj) {
        return obj instanceof Moment || (obj != null && obj._isAMomentObject != null);
    }

    function absFloor (number) {
        if (number < 0) {
            // -0 -> 0
            return Math.ceil(number) || 0;
        } else {
            return Math.floor(number);
        }
    }

    function toInt(argumentForCoercion) {
        var coercedNumber = +argumentForCoercion,
            value = 0;

        if (coercedNumber !== 0 && isFinite(coercedNumber)) {
            value = absFloor(coercedNumber);
        }

        return value;
    }

    // compare two arrays, return the number of differences
    function compareArrays(array1, array2, dontConvert) {
        var len = Math.min(array1.length, array2.length),
            lengthDiff = Math.abs(array1.length - array2.length),
            diffs = 0,
            i;
        for (i = 0; i < len; i++) {
            if ((dontConvert && array1[i] !== array2[i]) ||
                (!dontConvert && toInt(array1[i]) !== toInt(array2[i]))) {
                diffs++;
            }
        }
        return diffs + lengthDiff;
    }

    function warn(msg) {
        if (hooks.suppressDeprecationWarnings === false &&
                (typeof console !==  'undefined') && console.warn) {
            console.warn('Deprecation warning: ' + msg);
        }
    }

    function deprecate(msg, fn) {
        var firstTime = true;

        return extend(function () {
            if (hooks.deprecationHandler != null) {
                hooks.deprecationHandler(null, msg);
            }
            if (firstTime) {
                var args = [];
                var arg;
                for (var i = 0; i < arguments.length; i++) {
                    arg = '';
                    if (typeof arguments[i] === 'object') {
                        arg += '\n[' + i + '] ';
                        for (var key in arguments[0]) {
                            arg += key + ': ' + arguments[0][key] + ', ';
                        }
                        arg = arg.slice(0, -2); // Remove trailing comma and space
                    } else {
                        arg = arguments[i];
                    }
                    args.push(arg);
                }
                warn(msg + '\nArguments: ' + Array.prototype.slice.call(args).join('') + '\n' + (new Error()).stack);
                firstTime = false;
            }
            return fn.apply(this, arguments);
        }, fn);
    }

    var deprecations = {};

    function deprecateSimple(name, msg) {
        if (hooks.deprecationHandler != null) {
            hooks.deprecationHandler(name, msg);
        }
        if (!deprecations[name]) {
            warn(msg);
            deprecations[name] = true;
        }
    }

    hooks.suppressDeprecationWarnings = false;
    hooks.deprecationHandler = null;

    function isFunction(input) {
        return input instanceof Function || Object.prototype.toString.call(input) === '[object Function]';
    }

    function set (config) {
        var prop, i;
        for (i in config) {
            prop = config[i];
            if (isFunction(prop)) {
                this[i] = prop;
            } else {
                this['_' + i] = prop;
            }
        }
        this._config = config;
        // Lenient ordinal parsing accepts just a number in addition to
        // number + (possibly) stuff coming from _dayOfMonthOrdinalParse.
        // TODO: Remove "ordinalParse" fallback in next major release.
        this._dayOfMonthOrdinalParseLenient = new RegExp(
            (this._dayOfMonthOrdinalParse.source || this._ordinalParse.source) +
                '|' + (/\d{1,2}/).source);
    }

    function mergeConfigs(parentConfig, childConfig) {
        var res = extend({}, parentConfig), prop;
        for (prop in childConfig) {
            if (hasOwnProp(childConfig, prop)) {
                if (isObject(parentConfig[prop]) && isObject(childConfig[prop])) {
                    res[prop] = {};
                    extend(res[prop], parentConfig[prop]);
                    extend(res[prop], childConfig[prop]);
                } else if (childConfig[prop] != null) {
                    res[prop] = childConfig[prop];
                } else {
                    delete res[prop];
                }
            }
        }
        for (prop in parentConfig) {
            if (hasOwnProp(parentConfig, prop) &&
                    !hasOwnProp(childConfig, prop) &&
                    isObject(parentConfig[prop])) {
                // make sure changes to properties don't modify parent config
                res[prop] = extend({}, res[prop]);
            }
        }
        return res;
    }

    function Locale(config) {
        if (config != null) {
            this.set(config);
        }
    }

    var keys;

    if (Object.keys) {
        keys = Object.keys;
    } else {
        keys = function (obj) {
            var i, res = [];
            for (i in obj) {
                if (hasOwnProp(obj, i)) {
                    res.push(i);
                }
            }
            return res;
        };
    }

    var defaultCalendar = {
        sameDay : '[Today at] LT',
        nextDay : '[Tomorrow at] LT',
        nextWeek : 'dddd [at] LT',
        lastDay : '[Yesterday at] LT',
        lastWeek : '[Last] dddd [at] LT',
        sameElse : 'L'
    };

    function calendar (key, mom, now) {
        var output = this._calendar[key] || this._calendar['sameElse'];
        return isFunction(output) ? output.call(mom, now) : output;
    }

    var defaultLongDateFormat = {
        LTS  : 'h:mm:ss A',
        LT   : 'h:mm A',
        L    : 'MM/DD/YYYY',
        LL   : 'MMMM D, YYYY',
        LLL  : 'MMMM D, YYYY h:mm A',
        LLLL : 'dddd, MMMM D, YYYY h:mm A'
    };

    function longDateFormat (key) {
        var format = this._longDateFormat[key],
            formatUpper = this._longDateFormat[key.toUpperCase()];

        if (format || !formatUpper) {
            return format;
        }

        this._longDateFormat[key] = formatUpper.replace(/MMMM|MM|DD|dddd/g, function (val) {
            return val.slice(1);
        });

        return this._longDateFormat[key];
    }

    var defaultInvalidDate = 'Invalid date';

    function invalidDate () {
        return this._invalidDate;
    }

    var defaultOrdinal = '%d';
    var defaultDayOfMonthOrdinalParse = /\d{1,2}/;

    function ordinal (number) {
        return this._ordinal.replace('%d', number);
    }

    var defaultRelativeTime = {
        future : 'in %s',
        past   : '%s ago',
        s  : 'a few seconds',
        ss : '%d seconds',
        m  : 'a minute',
        mm : '%d minutes',
        h  : 'an hour',
        hh : '%d hours',
        d  : 'a day',
        dd : '%d days',
        M  : 'a month',
        MM : '%d months',
        y  : 'a year',
        yy : '%d years'
    };

    function relativeTime (number, withoutSuffix, string, isFuture) {
        var output = this._relativeTime[string];
        return (isFunction(output)) ?
            output(number, withoutSuffix, string, isFuture) :
            output.replace(/%d/i, number);
    }

    function pastFuture (diff, output) {
        var format = this._relativeTime[diff > 0 ? 'future' : 'past'];
        return isFunction(format) ? format(output) : format.replace(/%s/i, output);
    }

    var aliases = {};

    function addUnitAlias (unit, shorthand) {
        var lowerCase = unit.toLowerCase();
        aliases[lowerCase] = aliases[lowerCase + 's'] = aliases[shorthand] = unit;
    }

    function normalizeUnits(units) {
        return typeof units === 'string' ? aliases[units] || aliases[units.toLowerCase()] : undefined;
    }

    function normalizeObjectUnits(inputObject) {
        var normalizedInput = {},
            normalizedProp,
            prop;

        for (prop in inputObject) {
            if (hasOwnProp(inputObject, prop)) {
                normalizedProp = normalizeUnits(prop);
                if (normalizedProp) {
                    normalizedInput[normalizedProp] = inputObject[prop];
                }
            }
        }

        return normalizedInput;
    }

    var priorities = {};

    function addUnitPriority(unit, priority) {
        priorities[unit] = priority;
    }

    function getPrioritizedUnits(unitsObj) {
        var units = [];
        for (var u in unitsObj) {
            units.push({unit: u, priority: priorities[u]});
        }
        units.sort(function (a, b) {
            return a.priority - b.priority;
        });
        return units;
    }

    function zeroFill(number, targetLength, forceSign) {
        var absNumber = '' + Math.abs(number),
            zerosToFill = targetLength - absNumber.length,
            sign = number >= 0;
        return (sign ? (forceSign ? '+' : '') : '-') +
            Math.pow(10, Math.max(0, zerosToFill)).toString().substr(1) + absNumber;
    }

    var formattingTokens = /(\[[^\[]*\])|(\\)?([Hh]mm(ss)?|Mo|MM?M?M?|Do|DDDo|DD?D?D?|ddd?d?|do?|w[o|w]?|W[o|W]?|Qo?|YYYYYY|YYYYY|YYYY|YY|gg(ggg?)?|GG(GGG?)?|e|E|a|A|hh?|HH?|kk?|mm?|ss?|S{1,9}|x|X|zz?|ZZ?|.)/g;

    var localFormattingTokens = /(\[[^\[]*\])|(\\)?(LTS|LT|LL?L?L?|l{1,4})/g;

    var formatFunctions = {};

    var formatTokenFunctions = {};

    // token:    'M'
    // padded:   ['MM', 2]
    // ordinal:  'Mo'
    // callback: function () { this.month() + 1 }
    function addFormatToken (token, padded, ordinal, callback) {
        var func = callback;
        if (typeof callback === 'string') {
            func = function () {
                return this[callback]();
            };
        }
        if (token) {
            formatTokenFunctions[token] = func;
        }
        if (padded) {
            formatTokenFunctions[padded[0]] = function () {
                return zeroFill(func.apply(this, arguments), padded[1], padded[2]);
            };
        }
        if (ordinal) {
            formatTokenFunctions[ordinal] = function () {
                return this.localeData().ordinal(func.apply(this, arguments), token);
            };
        }
    }

    function removeFormattingTokens(input) {
        if (input.match(/\[[\s\S]/)) {
            return input.replace(/^\[|\]$/g, '');
        }
        return input.replace(/\\/g, '');
    }

    function makeFormatFunction(format) {
        var array = format.match(formattingTokens), i, length;

        for (i = 0, length = array.length; i < length; i++) {
            if (formatTokenFunctions[array[i]]) {
                array[i] = formatTokenFunctions[array[i]];
            } else {
                array[i] = removeFormattingTokens(array[i]);
            }
        }

        return function (mom) {
            var output = '', i;
            for (i = 0; i < length; i++) {
                output += isFunction(array[i]) ? array[i].call(mom, format) : array[i];
            }
            return output;
        };
    }

    // format date using native date object
    function formatMoment(m, format) {
        if (!m.isValid()) {
            return m.localeData().invalidDate();
        }

        format = expandFormat(format, m.localeData());
        formatFunctions[format] = formatFunctions[format] || makeFormatFunction(format);

        return formatFunctions[format](m);
    }

    function expandFormat(format, locale) {
        var i = 5;

        function replaceLongDateFormatTokens(input) {
            return locale.longDateFormat(input) || input;
        }

        localFormattingTokens.lastIndex = 0;
        while (i >= 0 && localFormattingTokens.test(format)) {
            format = format.replace(localFormattingTokens, replaceLongDateFormatTokens);
            localFormattingTokens.lastIndex = 0;
            i -= 1;
        }

        return format;
    }

    var match1         = /\d/;            //       0 - 9
    var match2         = /\d\d/;          //      00 - 99
    var match3         = /\d{3}/;         //     000 - 999
    var match4         = /\d{4}/;         //    0000 - 9999
    var match6         = /[+-]?\d{6}/;    // -999999 - 999999
    var match1to2      = /\d\d?/;         //       0 - 99
    var match3to4      = /\d\d\d\d?/;     //     999 - 9999
    var match5to6      = /\d\d\d\d\d\d?/; //   99999 - 999999
    var match1to3      = /\d{1,3}/;       //       0 - 999
    var match1to4      = /\d{1,4}/;       //       0 - 9999
    var match1to6      = /[+-]?\d{1,6}/;  // -999999 - 999999

    var matchUnsigned  = /\d+/;           //       0 - inf
    var matchSigned    = /[+-]?\d+/;      //    -inf - inf

    var matchOffset    = /Z|[+-]\d\d:?\d\d/gi; // +00:00 -00:00 +0000 -0000 or Z
    var matchShortOffset = /Z|[+-]\d\d(?::?\d\d)?/gi; // +00 -00 +00:00 -00:00 +0000 -0000 or Z

    var matchTimestamp = /[+-]?\d+(\.\d{1,3})?/; // 123456789 123456789.123

    // any word (or two) characters or numbers including two/three word month in arabic.
    // includes scottish gaelic two word and hyphenated months
    var matchWord = /[0-9]{0,256}['a-z\u00A0-\u05FF\u0700-\uD7FF\uF900-\uFDCF\uFDF0-\uFF07\uFF10-\uFFEF]{1,256}|[\u0600-\u06FF\/]{1,256}(\s*?[\u0600-\u06FF]{1,256}){1,2}/i;

    var regexes = {};

    function addRegexToken (token, regex, strictRegex) {
        regexes[token] = isFunction(regex) ? regex : function (isStrict, localeData) {
            return (isStrict && strictRegex) ? strictRegex : regex;
        };
    }

    function getParseRegexForToken (token, config) {
        if (!hasOwnProp(regexes, token)) {
            return new RegExp(unescapeFormat(token));
        }

        return regexes[token](config._strict, config._locale);
    }

    // Code from http://stackoverflow.com/questions/3561493/is-there-a-regexp-escape-function-in-javascript
    function unescapeFormat(s) {
        return regexEscape(s.replace('\\', '').replace(/\\(\[)|\\(\])|\[([^\]\[]*)\]|\\(.)/g, function (matched, p1, p2, p3, p4) {
            return p1 || p2 || p3 || p4;
        }));
    }

    function regexEscape(s) {
        return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    }

    var tokens = {};

    function addParseToken (token, callback) {
        var i, func = callback;
        if (typeof token === 'string') {
            token = [token];
        }
        if (isNumber(callback)) {
            func = function (input, array) {
                array[callback] = toInt(input);
            };
        }
        for (i = 0; i < token.length; i++) {
            tokens[token[i]] = func;
        }
    }

    function addWeekParseToken (token, callback) {
        addParseToken(token, function (input, array, config, token) {
            config._w = config._w || {};
            callback(input, config._w, config, token);
        });
    }

    function addTimeToArrayFromToken(token, input, config) {
        if (input != null && hasOwnProp(tokens, token)) {
            tokens[token](input, config._a, config, token);
        }
    }

    var YEAR = 0;
    var MONTH = 1;
    var DATE = 2;
    var HOUR = 3;
    var MINUTE = 4;
    var SECOND = 5;
    var MILLISECOND = 6;
    var WEEK = 7;
    var WEEKDAY = 8;

    // FORMATTING

    addFormatToken('Y', 0, 0, function () {
        var y = this.year();
        return y <= 9999 ? '' + y : '+' + y;
    });

    addFormatToken(0, ['YY', 2], 0, function () {
        return this.year() % 100;
    });

    addFormatToken(0, ['YYYY',   4],       0, 'year');
    addFormatToken(0, ['YYYYY',  5],       0, 'year');
    addFormatToken(0, ['YYYYYY', 6, true], 0, 'year');

    // ALIASES

    addUnitAlias('year', 'y');

    // PRIORITIES

    addUnitPriority('year', 1);

    // PARSING

    addRegexToken('Y',      matchSigned);
    addRegexToken('YY',     match1to2, match2);
    addRegexToken('YYYY',   match1to4, match4);
    addRegexToken('YYYYY',  match1to6, match6);
    addRegexToken('YYYYYY', match1to6, match6);

    addParseToken(['YYYYY', 'YYYYYY'], YEAR);
    addParseToken('YYYY', function (input, array) {
        array[YEAR] = input.length === 2 ? hooks.parseTwoDigitYear(input) : toInt(input);
    });
    addParseToken('YY', function (input, array) {
        array[YEAR] = hooks.parseTwoDigitYear(input);
    });
    addParseToken('Y', function (input, array) {
        array[YEAR] = parseInt(input, 10);
    });

    // HELPERS

    function daysInYear(year) {
        return isLeapYear(year) ? 366 : 365;
    }

    function isLeapYear(year) {
        return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    }

    // HOOKS

    hooks.parseTwoDigitYear = function (input) {
        return toInt(input) + (toInt(input) > 68 ? 1900 : 2000);
    };

    // MOMENTS

    var getSetYear = makeGetSet('FullYear', true);

    function getIsLeapYear () {
        return isLeapYear(this.year());
    }

    function makeGetSet (unit, keepTime) {
        return function (value) {
            if (value != null) {
                set$1(this, unit, value);
                hooks.updateOffset(this, keepTime);
                return this;
            } else {
                return get(this, unit);
            }
        };
    }

    function get (mom, unit) {
        return mom.isValid() ?
            mom._d['get' + (mom._isUTC ? 'UTC' : '') + unit]() : NaN;
    }

    function set$1 (mom, unit, value) {
        if (mom.isValid() && !isNaN(value)) {
            if (unit === 'FullYear' && isLeapYear(mom.year()) && mom.month() === 1 && mom.date() === 29) {
                mom._d['set' + (mom._isUTC ? 'UTC' : '') + unit](value, mom.month(), daysInMonth(value, mom.month()));
            }
            else {
                mom._d['set' + (mom._isUTC ? 'UTC' : '') + unit](value);
            }
        }
    }

    // MOMENTS

    function stringGet (units) {
        units = normalizeUnits(units);
        if (isFunction(this[units])) {
            return this[units]();
        }
        return this;
    }


    function stringSet (units, value) {
        if (typeof units === 'object') {
            units = normalizeObjectUnits(units);
            var prioritized = getPrioritizedUnits(units);
            for (var i = 0; i < prioritized.length; i++) {
                this[prioritized[i].unit](units[prioritized[i].unit]);
            }
        } else {
            units = normalizeUnits(units);
            if (isFunction(this[units])) {
                return this[units](value);
            }
        }
        return this;
    }

    function mod(n, x) {
        return ((n % x) + x) % x;
    }

    var indexOf;

    if (Array.prototype.indexOf) {
        indexOf = Array.prototype.indexOf;
    } else {
        indexOf = function (o) {
            // I know
            var i;
            for (i = 0; i < this.length; ++i) {
                if (this[i] === o) {
                    return i;
                }
            }
            return -1;
        };
    }

    function daysInMonth(year, month) {
        if (isNaN(year) || isNaN(month)) {
            return NaN;
        }
        var modMonth = mod(month, 12);
        year += (month - modMonth) / 12;
        return modMonth === 1 ? (isLeapYear(year) ? 29 : 28) : (31 - modMonth % 7 % 2);
    }

    // FORMATTING

    addFormatToken('M', ['MM', 2], 'Mo', function () {
        return this.month() + 1;
    });

    addFormatToken('MMM', 0, 0, function (format) {
        return this.localeData().monthsShort(this, format);
    });

    addFormatToken('MMMM', 0, 0, function (format) {
        return this.localeData().months(this, format);
    });

    // ALIASES

    addUnitAlias('month', 'M');

    // PRIORITY

    addUnitPriority('month', 8);

    // PARSING

    addRegexToken('M',    match1to2);
    addRegexToken('MM',   match1to2, match2);
    addRegexToken('MMM',  function (isStrict, locale) {
        return locale.monthsShortRegex(isStrict);
    });
    addRegexToken('MMMM', function (isStrict, locale) {
        return locale.monthsRegex(isStrict);
    });

    addParseToken(['M', 'MM'], function (input, array) {
        array[MONTH] = toInt(input) - 1;
    });

    addParseToken(['MMM', 'MMMM'], function (input, array, config, token) {
        var month = config._locale.monthsParse(input, token, config._strict);
        // if we didn't find a month name, mark the date as invalid.
        if (month != null) {
            array[MONTH] = month;
        } else {
            getParsingFlags(config).invalidMonth = input;
        }
    });

    // LOCALES

    var MONTHS_IN_FORMAT = /D[oD]?(\[[^\[\]]*\]|\s)+MMMM?/;
    var defaultLocaleMonths = 'January_February_March_April_May_June_July_August_September_October_November_December'.split('_');
    function localeMonths (m, format) {
        if (!m) {
            return isArray(this._months) ? this._months :
                this._months['standalone'];
        }
        return isArray(this._months) ? this._months[m.month()] :
            this._months[(this._months.isFormat || MONTHS_IN_FORMAT).test(format) ? 'format' : 'standalone'][m.month()];
    }

    var defaultLocaleMonthsShort = 'Jan_Feb_Mar_Apr_May_Jun_Jul_Aug_Sep_Oct_Nov_Dec'.split('_');
    function localeMonthsShort (m, format) {
        if (!m) {
            return isArray(this._monthsShort) ? this._monthsShort :
                this._monthsShort['standalone'];
        }
        return isArray(this._monthsShort) ? this._monthsShort[m.month()] :
            this._monthsShort[MONTHS_IN_FORMAT.test(format) ? 'format' : 'standalone'][m.month()];
    }

    function handleStrictParse(monthName, format, strict) {
        var i, ii, mom, llc = monthName.toLocaleLowerCase();
        if (!this._monthsParse) {
            // this is not used
            this._monthsParse = [];
            this._longMonthsParse = [];
            this._shortMonthsParse = [];
            for (i = 0; i < 12; ++i) {
                mom = createUTC([2000, i]);
                this._shortMonthsParse[i] = this.monthsShort(mom, '').toLocaleLowerCase();
                this._longMonthsParse[i] = this.months(mom, '').toLocaleLowerCase();
            }
        }

        if (strict) {
            if (format === 'MMM') {
                ii = indexOf.call(this._shortMonthsParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._longMonthsParse, llc);
                return ii !== -1 ? ii : null;
            }
        } else {
            if (format === 'MMM') {
                ii = indexOf.call(this._shortMonthsParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._longMonthsParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._longMonthsParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._shortMonthsParse, llc);
                return ii !== -1 ? ii : null;
            }
        }
    }

    function localeMonthsParse (monthName, format, strict) {
        var i, mom, regex;

        if (this._monthsParseExact) {
            return handleStrictParse.call(this, monthName, format, strict);
        }

        if (!this._monthsParse) {
            this._monthsParse = [];
            this._longMonthsParse = [];
            this._shortMonthsParse = [];
        }

        // TODO: add sorting
        // Sorting makes sure if one month (or abbr) is a prefix of another
        // see sorting in computeMonthsParse
        for (i = 0; i < 12; i++) {
            // make the regex if we don't have it already
            mom = createUTC([2000, i]);
            if (strict && !this._longMonthsParse[i]) {
                this._longMonthsParse[i] = new RegExp('^' + this.months(mom, '').replace('.', '') + '$', 'i');
                this._shortMonthsParse[i] = new RegExp('^' + this.monthsShort(mom, '').replace('.', '') + '$', 'i');
            }
            if (!strict && !this._monthsParse[i]) {
                regex = '^' + this.months(mom, '') + '|^' + this.monthsShort(mom, '');
                this._monthsParse[i] = new RegExp(regex.replace('.', ''), 'i');
            }
            // test the regex
            if (strict && format === 'MMMM' && this._longMonthsParse[i].test(monthName)) {
                return i;
            } else if (strict && format === 'MMM' && this._shortMonthsParse[i].test(monthName)) {
                return i;
            } else if (!strict && this._monthsParse[i].test(monthName)) {
                return i;
            }
        }
    }

    // MOMENTS

    function setMonth (mom, value) {
        var dayOfMonth;

        if (!mom.isValid()) {
            // No op
            return mom;
        }

        if (typeof value === 'string') {
            if (/^\d+$/.test(value)) {
                value = toInt(value);
            } else {
                value = mom.localeData().monthsParse(value);
                // TODO: Another silent failure?
                if (!isNumber(value)) {
                    return mom;
                }
            }
        }

        dayOfMonth = Math.min(mom.date(), daysInMonth(mom.year(), value));
        mom._d['set' + (mom._isUTC ? 'UTC' : '') + 'Month'](value, dayOfMonth);
        return mom;
    }

    function getSetMonth (value) {
        if (value != null) {
            setMonth(this, value);
            hooks.updateOffset(this, true);
            return this;
        } else {
            return get(this, 'Month');
        }
    }

    function getDaysInMonth () {
        return daysInMonth(this.year(), this.month());
    }

    var defaultMonthsShortRegex = matchWord;
    function monthsShortRegex (isStrict) {
        if (this._monthsParseExact) {
            if (!hasOwnProp(this, '_monthsRegex')) {
                computeMonthsParse.call(this);
            }
            if (isStrict) {
                return this._monthsShortStrictRegex;
            } else {
                return this._monthsShortRegex;
            }
        } else {
            if (!hasOwnProp(this, '_monthsShortRegex')) {
                this._monthsShortRegex = defaultMonthsShortRegex;
            }
            return this._monthsShortStrictRegex && isStrict ?
                this._monthsShortStrictRegex : this._monthsShortRegex;
        }
    }

    var defaultMonthsRegex = matchWord;
    function monthsRegex (isStrict) {
        if (this._monthsParseExact) {
            if (!hasOwnProp(this, '_monthsRegex')) {
                computeMonthsParse.call(this);
            }
            if (isStrict) {
                return this._monthsStrictRegex;
            } else {
                return this._monthsRegex;
            }
        } else {
            if (!hasOwnProp(this, '_monthsRegex')) {
                this._monthsRegex = defaultMonthsRegex;
            }
            return this._monthsStrictRegex && isStrict ?
                this._monthsStrictRegex : this._monthsRegex;
        }
    }

    function computeMonthsParse () {
        function cmpLenRev(a, b) {
            return b.length - a.length;
        }

        var shortPieces = [], longPieces = [], mixedPieces = [],
            i, mom;
        for (i = 0; i < 12; i++) {
            // make the regex if we don't have it already
            mom = createUTC([2000, i]);
            shortPieces.push(this.monthsShort(mom, ''));
            longPieces.push(this.months(mom, ''));
            mixedPieces.push(this.months(mom, ''));
            mixedPieces.push(this.monthsShort(mom, ''));
        }
        // Sorting makes sure if one month (or abbr) is a prefix of another it
        // will match the longer piece.
        shortPieces.sort(cmpLenRev);
        longPieces.sort(cmpLenRev);
        mixedPieces.sort(cmpLenRev);
        for (i = 0; i < 12; i++) {
            shortPieces[i] = regexEscape(shortPieces[i]);
            longPieces[i] = regexEscape(longPieces[i]);
        }
        for (i = 0; i < 24; i++) {
            mixedPieces[i] = regexEscape(mixedPieces[i]);
        }

        this._monthsRegex = new RegExp('^(' + mixedPieces.join('|') + ')', 'i');
        this._monthsShortRegex = this._monthsRegex;
        this._monthsStrictRegex = new RegExp('^(' + longPieces.join('|') + ')', 'i');
        this._monthsShortStrictRegex = new RegExp('^(' + shortPieces.join('|') + ')', 'i');
    }

    function createDate (y, m, d, h, M, s, ms) {
        // can't just apply() to create a date:
        // https://stackoverflow.com/q/181348
        var date;
        // the date constructor remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0) {
            // preserve leap years using a full 400 year cycle, then reset
            date = new Date(y + 400, m, d, h, M, s, ms);
            if (isFinite(date.getFullYear())) {
                date.setFullYear(y);
            }
        } else {
            date = new Date(y, m, d, h, M, s, ms);
        }

        return date;
    }

    function createUTCDate (y) {
        var date;
        // the Date.UTC function remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0) {
            var args = Array.prototype.slice.call(arguments);
            // preserve leap years using a full 400 year cycle, then reset
            args[0] = y + 400;
            date = new Date(Date.UTC.apply(null, args));
            if (isFinite(date.getUTCFullYear())) {
                date.setUTCFullYear(y);
            }
        } else {
            date = new Date(Date.UTC.apply(null, arguments));
        }

        return date;
    }

    // start-of-first-week - start-of-year
    function firstWeekOffset(year, dow, doy) {
        var // first-week day -- which january is always in the first week (4 for iso, 1 for other)
            fwd = 7 + dow - doy,
            // first-week day local weekday -- which local weekday is fwd
            fwdlw = (7 + createUTCDate(year, 0, fwd).getUTCDay() - dow) % 7;

        return -fwdlw + fwd - 1;
    }

    // https://en.wikipedia.org/wiki/ISO_week_date#Calculating_a_date_given_the_year.2C_week_number_and_weekday
    function dayOfYearFromWeeks(year, week, weekday, dow, doy) {
        var localWeekday = (7 + weekday - dow) % 7,
            weekOffset = firstWeekOffset(year, dow, doy),
            dayOfYear = 1 + 7 * (week - 1) + localWeekday + weekOffset,
            resYear, resDayOfYear;

        if (dayOfYear <= 0) {
            resYear = year - 1;
            resDayOfYear = daysInYear(resYear) + dayOfYear;
        } else if (dayOfYear > daysInYear(year)) {
            resYear = year + 1;
            resDayOfYear = dayOfYear - daysInYear(year);
        } else {
            resYear = year;
            resDayOfYear = dayOfYear;
        }

        return {
            year: resYear,
            dayOfYear: resDayOfYear
        };
    }

    function weekOfYear(mom, dow, doy) {
        var weekOffset = firstWeekOffset(mom.year(), dow, doy),
            week = Math.floor((mom.dayOfYear() - weekOffset - 1) / 7) + 1,
            resWeek, resYear;

        if (week < 1) {
            resYear = mom.year() - 1;
            resWeek = week + weeksInYear(resYear, dow, doy);
        } else if (week > weeksInYear(mom.year(), dow, doy)) {
            resWeek = week - weeksInYear(mom.year(), dow, doy);
            resYear = mom.year() + 1;
        } else {
            resYear = mom.year();
            resWeek = week;
        }

        return {
            week: resWeek,
            year: resYear
        };
    }

    function weeksInYear(year, dow, doy) {
        var weekOffset = firstWeekOffset(year, dow, doy),
            weekOffsetNext = firstWeekOffset(year + 1, dow, doy);
        return (daysInYear(year) - weekOffset + weekOffsetNext) / 7;
    }

    // FORMATTING

    addFormatToken('w', ['ww', 2], 'wo', 'week');
    addFormatToken('W', ['WW', 2], 'Wo', 'isoWeek');

    // ALIASES

    addUnitAlias('week', 'w');
    addUnitAlias('isoWeek', 'W');

    // PRIORITIES

    addUnitPriority('week', 5);
    addUnitPriority('isoWeek', 5);

    // PARSING

    addRegexToken('w',  match1to2);
    addRegexToken('ww', match1to2, match2);
    addRegexToken('W',  match1to2);
    addRegexToken('WW', match1to2, match2);

    addWeekParseToken(['w', 'ww', 'W', 'WW'], function (input, week, config, token) {
        week[token.substr(0, 1)] = toInt(input);
    });

    // HELPERS

    // LOCALES

    function localeWeek (mom) {
        return weekOfYear(mom, this._week.dow, this._week.doy).week;
    }

    var defaultLocaleWeek = {
        dow : 0, // Sunday is the first day of the week.
        doy : 6  // The week that contains Jan 6th is the first week of the year.
    };

    function localeFirstDayOfWeek () {
        return this._week.dow;
    }

    function localeFirstDayOfYear () {
        return this._week.doy;
    }

    // MOMENTS

    function getSetWeek (input) {
        var week = this.localeData().week(this);
        return input == null ? week : this.add((input - week) * 7, 'd');
    }

    function getSetISOWeek (input) {
        var week = weekOfYear(this, 1, 4).week;
        return input == null ? week : this.add((input - week) * 7, 'd');
    }

    // FORMATTING

    addFormatToken('d', 0, 'do', 'day');

    addFormatToken('dd', 0, 0, function (format) {
        return this.localeData().weekdaysMin(this, format);
    });

    addFormatToken('ddd', 0, 0, function (format) {
        return this.localeData().weekdaysShort(this, format);
    });

    addFormatToken('dddd', 0, 0, function (format) {
        return this.localeData().weekdays(this, format);
    });

    addFormatToken('e', 0, 0, 'weekday');
    addFormatToken('E', 0, 0, 'isoWeekday');

    // ALIASES

    addUnitAlias('day', 'd');
    addUnitAlias('weekday', 'e');
    addUnitAlias('isoWeekday', 'E');

    // PRIORITY
    addUnitPriority('day', 11);
    addUnitPriority('weekday', 11);
    addUnitPriority('isoWeekday', 11);

    // PARSING

    addRegexToken('d',    match1to2);
    addRegexToken('e',    match1to2);
    addRegexToken('E',    match1to2);
    addRegexToken('dd',   function (isStrict, locale) {
        return locale.weekdaysMinRegex(isStrict);
    });
    addRegexToken('ddd',   function (isStrict, locale) {
        return locale.weekdaysShortRegex(isStrict);
    });
    addRegexToken('dddd',   function (isStrict, locale) {
        return locale.weekdaysRegex(isStrict);
    });

    addWeekParseToken(['dd', 'ddd', 'dddd'], function (input, week, config, token) {
        var weekday = config._locale.weekdaysParse(input, token, config._strict);
        // if we didn't get a weekday name, mark the date as invalid
        if (weekday != null) {
            week.d = weekday;
        } else {
            getParsingFlags(config).invalidWeekday = input;
        }
    });

    addWeekParseToken(['d', 'e', 'E'], function (input, week, config, token) {
        week[token] = toInt(input);
    });

    // HELPERS

    function parseWeekday(input, locale) {
        if (typeof input !== 'string') {
            return input;
        }

        if (!isNaN(input)) {
            return parseInt(input, 10);
        }

        input = locale.weekdaysParse(input);
        if (typeof input === 'number') {
            return input;
        }

        return null;
    }

    function parseIsoWeekday(input, locale) {
        if (typeof input === 'string') {
            return locale.weekdaysParse(input) % 7 || 7;
        }
        return isNaN(input) ? null : input;
    }

    // LOCALES
    function shiftWeekdays (ws, n) {
        return ws.slice(n, 7).concat(ws.slice(0, n));
    }

    var defaultLocaleWeekdays = 'Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday'.split('_');
    function localeWeekdays (m, format) {
        var weekdays = isArray(this._weekdays) ? this._weekdays :
            this._weekdays[(m && m !== true && this._weekdays.isFormat.test(format)) ? 'format' : 'standalone'];
        return (m === true) ? shiftWeekdays(weekdays, this._week.dow)
            : (m) ? weekdays[m.day()] : weekdays;
    }

    var defaultLocaleWeekdaysShort = 'Sun_Mon_Tue_Wed_Thu_Fri_Sat'.split('_');
    function localeWeekdaysShort (m) {
        return (m === true) ? shiftWeekdays(this._weekdaysShort, this._week.dow)
            : (m) ? this._weekdaysShort[m.day()] : this._weekdaysShort;
    }

    var defaultLocaleWeekdaysMin = 'Su_Mo_Tu_We_Th_Fr_Sa'.split('_');
    function localeWeekdaysMin (m) {
        return (m === true) ? shiftWeekdays(this._weekdaysMin, this._week.dow)
            : (m) ? this._weekdaysMin[m.day()] : this._weekdaysMin;
    }

    function handleStrictParse$1(weekdayName, format, strict) {
        var i, ii, mom, llc = weekdayName.toLocaleLowerCase();
        if (!this._weekdaysParse) {
            this._weekdaysParse = [];
            this._shortWeekdaysParse = [];
            this._minWeekdaysParse = [];

            for (i = 0; i < 7; ++i) {
                mom = createUTC([2000, 1]).day(i);
                this._minWeekdaysParse[i] = this.weekdaysMin(mom, '').toLocaleLowerCase();
                this._shortWeekdaysParse[i] = this.weekdaysShort(mom, '').toLocaleLowerCase();
                this._weekdaysParse[i] = this.weekdays(mom, '').toLocaleLowerCase();
            }
        }

        if (strict) {
            if (format === 'dddd') {
                ii = indexOf.call(this._weekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else if (format === 'ddd') {
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._minWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            }
        } else {
            if (format === 'dddd') {
                ii = indexOf.call(this._weekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._minWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else if (format === 'ddd') {
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._weekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._minWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._minWeekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._weekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            }
        }
    }

    function localeWeekdaysParse (weekdayName, format, strict) {
        var i, mom, regex;

        if (this._weekdaysParseExact) {
            return handleStrictParse$1.call(this, weekdayName, format, strict);
        }

        if (!this._weekdaysParse) {
            this._weekdaysParse = [];
            this._minWeekdaysParse = [];
            this._shortWeekdaysParse = [];
            this._fullWeekdaysParse = [];
        }

        for (i = 0; i < 7; i++) {
            // make the regex if we don't have it already

            mom = createUTC([2000, 1]).day(i);
            if (strict && !this._fullWeekdaysParse[i]) {
                this._fullWeekdaysParse[i] = new RegExp('^' + this.weekdays(mom, '').replace('.', '\\.?') + '$', 'i');
                this._shortWeekdaysParse[i] = new RegExp('^' + this.weekdaysShort(mom, '').replace('.', '\\.?') + '$', 'i');
                this._minWeekdaysParse[i] = new RegExp('^' + this.weekdaysMin(mom, '').replace('.', '\\.?') + '$', 'i');
            }
            if (!this._weekdaysParse[i]) {
                regex = '^' + this.weekdays(mom, '') + '|^' + this.weekdaysShort(mom, '') + '|^' + this.weekdaysMin(mom, '');
                this._weekdaysParse[i] = new RegExp(regex.replace('.', ''), 'i');
            }
            // test the regex
            if (strict && format === 'dddd' && this._fullWeekdaysParse[i].test(weekdayName)) {
                return i;
            } else if (strict && format === 'ddd' && this._shortWeekdaysParse[i].test(weekdayName)) {
                return i;
            } else if (strict && format === 'dd' && this._minWeekdaysParse[i].test(weekdayName)) {
                return i;
            } else if (!strict && this._weekdaysParse[i].test(weekdayName)) {
                return i;
            }
        }
    }

    // MOMENTS

    function getSetDayOfWeek (input) {
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }
        var day = this._isUTC ? this._d.getUTCDay() : this._d.getDay();
        if (input != null) {
            input = parseWeekday(input, this.localeData());
            return this.add(input - day, 'd');
        } else {
            return day;
        }
    }

    function getSetLocaleDayOfWeek (input) {
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }
        var weekday = (this.day() + 7 - this.localeData()._week.dow) % 7;
        return input == null ? weekday : this.add(input - weekday, 'd');
    }

    function getSetISODayOfWeek (input) {
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }

        // behaves the same as moment#day except
        // as a getter, returns 7 instead of 0 (1-7 range instead of 0-6)
        // as a setter, sunday should belong to the previous week.

        if (input != null) {
            var weekday = parseIsoWeekday(input, this.localeData());
            return this.day(this.day() % 7 ? weekday : weekday - 7);
        } else {
            return this.day() || 7;
        }
    }

    var defaultWeekdaysRegex = matchWord;
    function weekdaysRegex (isStrict) {
        if (this._weekdaysParseExact) {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                computeWeekdaysParse.call(this);
            }
            if (isStrict) {
                return this._weekdaysStrictRegex;
            } else {
                return this._weekdaysRegex;
            }
        } else {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                this._weekdaysRegex = defaultWeekdaysRegex;
            }
            return this._weekdaysStrictRegex && isStrict ?
                this._weekdaysStrictRegex : this._weekdaysRegex;
        }
    }

    var defaultWeekdaysShortRegex = matchWord;
    function weekdaysShortRegex (isStrict) {
        if (this._weekdaysParseExact) {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                computeWeekdaysParse.call(this);
            }
            if (isStrict) {
                return this._weekdaysShortStrictRegex;
            } else {
                return this._weekdaysShortRegex;
            }
        } else {
            if (!hasOwnProp(this, '_weekdaysShortRegex')) {
                this._weekdaysShortRegex = defaultWeekdaysShortRegex;
            }
            return this._weekdaysShortStrictRegex && isStrict ?
                this._weekdaysShortStrictRegex : this._weekdaysShortRegex;
        }
    }

    var defaultWeekdaysMinRegex = matchWord;
    function weekdaysMinRegex (isStrict) {
        if (this._weekdaysParseExact) {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                computeWeekdaysParse.call(this);
            }
            if (isStrict) {
                return this._weekdaysMinStrictRegex;
            } else {
                return this._weekdaysMinRegex;
            }
        } else {
            if (!hasOwnProp(this, '_weekdaysMinRegex')) {
                this._weekdaysMinRegex = defaultWeekdaysMinRegex;
            }
            return this._weekdaysMinStrictRegex && isStrict ?
                this._weekdaysMinStrictRegex : this._weekdaysMinRegex;
        }
    }


    function computeWeekdaysParse () {
        function cmpLenRev(a, b) {
            return b.length - a.length;
        }

        var minPieces = [], shortPieces = [], longPieces = [], mixedPieces = [],
            i, mom, minp, shortp, longp;
        for (i = 0; i < 7; i++) {
            // make the regex if we don't have it already
            mom = createUTC([2000, 1]).day(i);
            minp = this.weekdaysMin(mom, '');
            shortp = this.weekdaysShort(mom, '');
            longp = this.weekdays(mom, '');
            minPieces.push(minp);
            shortPieces.push(shortp);
            longPieces.push(longp);
            mixedPieces.push(minp);
            mixedPieces.push(shortp);
            mixedPieces.push(longp);
        }
        // Sorting makes sure if one weekday (or abbr) is a prefix of another it
        // will match the longer piece.
        minPieces.sort(cmpLenRev);
        shortPieces.sort(cmpLenRev);
        longPieces.sort(cmpLenRev);
        mixedPieces.sort(cmpLenRev);
        for (i = 0; i < 7; i++) {
            shortPieces[i] = regexEscape(shortPieces[i]);
            longPieces[i] = regexEscape(longPieces[i]);
            mixedPieces[i] = regexEscape(mixedPieces[i]);
        }

        this._weekdaysRegex = new RegExp('^(' + mixedPieces.join('|') + ')', 'i');
        this._weekdaysShortRegex = this._weekdaysRegex;
        this._weekdaysMinRegex = this._weekdaysRegex;

        this._weekdaysStrictRegex = new RegExp('^(' + longPieces.join('|') + ')', 'i');
        this._weekdaysShortStrictRegex = new RegExp('^(' + shortPieces.join('|') + ')', 'i');
        this._weekdaysMinStrictRegex = new RegExp('^(' + minPieces.join('|') + ')', 'i');
    }

    // FORMATTING

    function hFormat() {
        return this.hours() % 12 || 12;
    }

    function kFormat() {
        return this.hours() || 24;
    }

    addFormatToken('H', ['HH', 2], 0, 'hour');
    addFormatToken('h', ['hh', 2], 0, hFormat);
    addFormatToken('k', ['kk', 2], 0, kFormat);

    addFormatToken('hmm', 0, 0, function () {
        return '' + hFormat.apply(this) + zeroFill(this.minutes(), 2);
    });

    addFormatToken('hmmss', 0, 0, function () {
        return '' + hFormat.apply(this) + zeroFill(this.minutes(), 2) +
            zeroFill(this.seconds(), 2);
    });

    addFormatToken('Hmm', 0, 0, function () {
        return '' + this.hours() + zeroFill(this.minutes(), 2);
    });

    addFormatToken('Hmmss', 0, 0, function () {
        return '' + this.hours() + zeroFill(this.minutes(), 2) +
            zeroFill(this.seconds(), 2);
    });

    function meridiem (token, lowercase) {
        addFormatToken(token, 0, 0, function () {
            return this.localeData().meridiem(this.hours(), this.minutes(), lowercase);
        });
    }

    meridiem('a', true);
    meridiem('A', false);

    // ALIASES

    addUnitAlias('hour', 'h');

    // PRIORITY
    addUnitPriority('hour', 13);

    // PARSING

    function matchMeridiem (isStrict, locale) {
        return locale._meridiemParse;
    }

    addRegexToken('a',  matchMeridiem);
    addRegexToken('A',  matchMeridiem);
    addRegexToken('H',  match1to2);
    addRegexToken('h',  match1to2);
    addRegexToken('k',  match1to2);
    addRegexToken('HH', match1to2, match2);
    addRegexToken('hh', match1to2, match2);
    addRegexToken('kk', match1to2, match2);

    addRegexToken('hmm', match3to4);
    addRegexToken('hmmss', match5to6);
    addRegexToken('Hmm', match3to4);
    addRegexToken('Hmmss', match5to6);

    addParseToken(['H', 'HH'], HOUR);
    addParseToken(['k', 'kk'], function (input, array, config) {
        var kInput = toInt(input);
        array[HOUR] = kInput === 24 ? 0 : kInput;
    });
    addParseToken(['a', 'A'], function (input, array, config) {
        config._isPm = config._locale.isPM(input);
        config._meridiem = input;
    });
    addParseToken(['h', 'hh'], function (input, array, config) {
        array[HOUR] = toInt(input);
        getParsingFlags(config).bigHour = true;
    });
    addParseToken('hmm', function (input, array, config) {
        var pos = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos));
        array[MINUTE] = toInt(input.substr(pos));
        getParsingFlags(config).bigHour = true;
    });
    addParseToken('hmmss', function (input, array, config) {
        var pos1 = input.length - 4;
        var pos2 = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos1));
        array[MINUTE] = toInt(input.substr(pos1, 2));
        array[SECOND] = toInt(input.substr(pos2));
        getParsingFlags(config).bigHour = true;
    });
    addParseToken('Hmm', function (input, array, config) {
        var pos = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos));
        array[MINUTE] = toInt(input.substr(pos));
    });
    addParseToken('Hmmss', function (input, array, config) {
        var pos1 = input.length - 4;
        var pos2 = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos1));
        array[MINUTE] = toInt(input.substr(pos1, 2));
        array[SECOND] = toInt(input.substr(pos2));
    });

    // LOCALES

    function localeIsPM (input) {
        // IE8 Quirks Mode & IE7 Standards Mode do not allow accessing strings like arrays
        // Using charAt should be more compatible.
        return ((input + '').toLowerCase().charAt(0) === 'p');
    }

    var defaultLocaleMeridiemParse = /[ap]\.?m?\.?/i;
    function localeMeridiem (hours, minutes, isLower) {
        if (hours > 11) {
            return isLower ? 'pm' : 'PM';
        } else {
            return isLower ? 'am' : 'AM';
        }
    }


    // MOMENTS

    // Setting the hour should keep the time, because the user explicitly
    // specified which hour they want. So trying to maintain the same hour (in
    // a new timezone) makes sense. Adding/subtracting hours does not follow
    // this rule.
    var getSetHour = makeGetSet('Hours', true);

    var baseConfig = {
        calendar: defaultCalendar,
        longDateFormat: defaultLongDateFormat,
        invalidDate: defaultInvalidDate,
        ordinal: defaultOrdinal,
        dayOfMonthOrdinalParse: defaultDayOfMonthOrdinalParse,
        relativeTime: defaultRelativeTime,

        months: defaultLocaleMonths,
        monthsShort: defaultLocaleMonthsShort,

        week: defaultLocaleWeek,

        weekdays: defaultLocaleWeekdays,
        weekdaysMin: defaultLocaleWeekdaysMin,
        weekdaysShort: defaultLocaleWeekdaysShort,

        meridiemParse: defaultLocaleMeridiemParse
    };

    // internal storage for locale config files
    var locales = {};
    var localeFamilies = {};
    var globalLocale;

    function normalizeLocale(key) {
        return key ? key.toLowerCase().replace('_', '-') : key;
    }

    // pick the locale from the array
    // try ['en-au', 'en-gb'] as 'en-au', 'en-gb', 'en', as in move through the list trying each
    // substring from most specific to least, but move to the next array item if it's a more specific variant than the current root
    function chooseLocale(names) {
        var i = 0, j, next, locale, split;

        while (i < names.length) {
            split = normalizeLocale(names[i]).split('-');
            j = split.length;
            next = normalizeLocale(names[i + 1]);
            next = next ? next.split('-') : null;
            while (j > 0) {
                locale = loadLocale(split.slice(0, j).join('-'));
                if (locale) {
                    return locale;
                }
                if (next && next.length >= j && compareArrays(split, next, true) >= j - 1) {
                    //the next array item is better than a shallower substring of this one
                    break;
                }
                j--;
            }
            i++;
        }
        return globalLocale;
    }

    function loadLocale(name) {
        var oldLocale = null;
        // TODO: Find a better way to register and load all the locales in Node
        if (!locales[name] && (typeof module !== 'undefined') &&
                module && module.exports) {
            try {
                oldLocale = globalLocale._abbr;
                var aliasedRequire = require;
                aliasedRequire('./locale/' + name);
                getSetGlobalLocale(oldLocale);
            } catch (e) {}
        }
        return locales[name];
    }

    // This function will load locale and then set the global locale.  If
    // no arguments are passed in, it will simply return the current global
    // locale key.
    function getSetGlobalLocale (key, values) {
        var data;
        if (key) {
            if (isUndefined(values)) {
                data = getLocale(key);
            }
            else {
                data = defineLocale(key, values);
            }

            if (data) {
                // moment.duration._locale = moment._locale = data;
                globalLocale = data;
            }
            else {
                if ((typeof console !==  'undefined') && console.warn) {
                    //warn user if arguments are passed but the locale could not be set
                    console.warn('Locale ' + key +  ' not found. Did you forget to load it?');
                }
            }
        }

        return globalLocale._abbr;
    }

    function defineLocale (name, config) {
        if (config !== null) {
            var locale, parentConfig = baseConfig;
            config.abbr = name;
            if (locales[name] != null) {
                deprecateSimple('defineLocaleOverride',
                        'use moment.updateLocale(localeName, config) to change ' +
                        'an existing locale. moment.defineLocale(localeName, ' +
                        'config) should only be used for creating a new locale ' +
                        'See http://momentjs.com/guides/#/warnings/define-locale/ for more info.');
                parentConfig = locales[name]._config;
            } else if (config.parentLocale != null) {
                if (locales[config.parentLocale] != null) {
                    parentConfig = locales[config.parentLocale]._config;
                } else {
                    locale = loadLocale(config.parentLocale);
                    if (locale != null) {
                        parentConfig = locale._config;
                    } else {
                        if (!localeFamilies[config.parentLocale]) {
                            localeFamilies[config.parentLocale] = [];
                        }
                        localeFamilies[config.parentLocale].push({
                            name: name,
                            config: config
                        });
                        return null;
                    }
                }
            }
            locales[name] = new Locale(mergeConfigs(parentConfig, config));

            if (localeFamilies[name]) {
                localeFamilies[name].forEach(function (x) {
                    defineLocale(x.name, x.config);
                });
            }

            // backwards compat for now: also set the locale
            // make sure we set the locale AFTER all child locales have been
            // created, so we won't end up with the child locale set.
            getSetGlobalLocale(name);


            return locales[name];
        } else {
            // useful for testing
            delete locales[name];
            return null;
        }
    }

    function updateLocale(name, config) {
        if (config != null) {
            var locale, tmpLocale, parentConfig = baseConfig;
            // MERGE
            tmpLocale = loadLocale(name);
            if (tmpLocale != null) {
                parentConfig = tmpLocale._config;
            }
            config = mergeConfigs(parentConfig, config);
            locale = new Locale(config);
            locale.parentLocale = locales[name];
            locales[name] = locale;

            // backwards compat for now: also set the locale
            getSetGlobalLocale(name);
        } else {
            // pass null for config to unupdate, useful for tests
            if (locales[name] != null) {
                if (locales[name].parentLocale != null) {
                    locales[name] = locales[name].parentLocale;
                } else if (locales[name] != null) {
                    delete locales[name];
                }
            }
        }
        return locales[name];
    }

    // returns locale data
    function getLocale (key) {
        var locale;

        if (key && key._locale && key._locale._abbr) {
            key = key._locale._abbr;
        }

        if (!key) {
            return globalLocale;
        }

        if (!isArray(key)) {
            //short-circuit everything else
            locale = loadLocale(key);
            if (locale) {
                return locale;
            }
            key = [key];
        }

        return chooseLocale(key);
    }

    function listLocales() {
        return keys(locales);
    }

    function checkOverflow (m) {
        var overflow;
        var a = m._a;

        if (a && getParsingFlags(m).overflow === -2) {
            overflow =
                a[MONTH]       < 0 || a[MONTH]       > 11  ? MONTH :
                a[DATE]        < 1 || a[DATE]        > daysInMonth(a[YEAR], a[MONTH]) ? DATE :
                a[HOUR]        < 0 || a[HOUR]        > 24 || (a[HOUR] === 24 && (a[MINUTE] !== 0 || a[SECOND] !== 0 || a[MILLISECOND] !== 0)) ? HOUR :
                a[MINUTE]      < 0 || a[MINUTE]      > 59  ? MINUTE :
                a[SECOND]      < 0 || a[SECOND]      > 59  ? SECOND :
                a[MILLISECOND] < 0 || a[MILLISECOND] > 999 ? MILLISECOND :
                -1;

            if (getParsingFlags(m)._overflowDayOfYear && (overflow < YEAR || overflow > DATE)) {
                overflow = DATE;
            }
            if (getParsingFlags(m)._overflowWeeks && overflow === -1) {
                overflow = WEEK;
            }
            if (getParsingFlags(m)._overflowWeekday && overflow === -1) {
                overflow = WEEKDAY;
            }

            getParsingFlags(m).overflow = overflow;
        }

        return m;
    }

    // Pick the first defined of two or three arguments.
    function defaults(a, b, c) {
        if (a != null) {
            return a;
        }
        if (b != null) {
            return b;
        }
        return c;
    }

    function currentDateArray(config) {
        // hooks is actually the exported moment object
        var nowValue = new Date(hooks.now());
        if (config._useUTC) {
            return [nowValue.getUTCFullYear(), nowValue.getUTCMonth(), nowValue.getUTCDate()];
        }
        return [nowValue.getFullYear(), nowValue.getMonth(), nowValue.getDate()];
    }

    // convert an array to a date.
    // the array should mirror the parameters below
    // note: all values past the year are optional and will default to the lowest possible value.
    // [year, month, day , hour, minute, second, millisecond]
    function configFromArray (config) {
        var i, date, input = [], currentDate, expectedWeekday, yearToUse;

        if (config._d) {
            return;
        }

        currentDate = currentDateArray(config);

        //compute day of the year from weeks and weekdays
        if (config._w && config._a[DATE] == null && config._a[MONTH] == null) {
            dayOfYearFromWeekInfo(config);
        }

        //if the day of the year is set, figure out what it is
        if (config._dayOfYear != null) {
            yearToUse = defaults(config._a[YEAR], currentDate[YEAR]);

            if (config._dayOfYear > daysInYear(yearToUse) || config._dayOfYear === 0) {
                getParsingFlags(config)._overflowDayOfYear = true;
            }

            date = createUTCDate(yearToUse, 0, config._dayOfYear);
            config._a[MONTH] = date.getUTCMonth();
            config._a[DATE] = date.getUTCDate();
        }

        // Default to current date.
        // * if no year, month, day of month are given, default to today
        // * if day of month is given, default month and year
        // * if month is given, default only year
        // * if year is given, don't default anything
        for (i = 0; i < 3 && config._a[i] == null; ++i) {
            config._a[i] = input[i] = currentDate[i];
        }

        // Zero out whatever was not defaulted, including time
        for (; i < 7; i++) {
            config._a[i] = input[i] = (config._a[i] == null) ? (i === 2 ? 1 : 0) : config._a[i];
        }

        // Check for 24:00:00.000
        if (config._a[HOUR] === 24 &&
                config._a[MINUTE] === 0 &&
                config._a[SECOND] === 0 &&
                config._a[MILLISECOND] === 0) {
            config._nextDay = true;
            config._a[HOUR] = 0;
        }

        config._d = (config._useUTC ? createUTCDate : createDate).apply(null, input);
        expectedWeekday = config._useUTC ? config._d.getUTCDay() : config._d.getDay();

        // Apply timezone offset from input. The actual utcOffset can be changed
        // with parseZone.
        if (config._tzm != null) {
            config._d.setUTCMinutes(config._d.getUTCMinutes() - config._tzm);
        }

        if (config._nextDay) {
            config._a[HOUR] = 24;
        }

        // check for mismatching day of week
        if (config._w && typeof config._w.d !== 'undefined' && config._w.d !== expectedWeekday) {
            getParsingFlags(config).weekdayMismatch = true;
        }
    }

    function dayOfYearFromWeekInfo(config) {
        var w, weekYear, week, weekday, dow, doy, temp, weekdayOverflow;

        w = config._w;
        if (w.GG != null || w.W != null || w.E != null) {
            dow = 1;
            doy = 4;

            // TODO: We need to take the current isoWeekYear, but that depends on
            // how we interpret now (local, utc, fixed offset). So create
            // a now version of current config (take local/utc/offset flags, and
            // create now).
            weekYear = defaults(w.GG, config._a[YEAR], weekOfYear(createLocal(), 1, 4).year);
            week = defaults(w.W, 1);
            weekday = defaults(w.E, 1);
            if (weekday < 1 || weekday > 7) {
                weekdayOverflow = true;
            }
        } else {
            dow = config._locale._week.dow;
            doy = config._locale._week.doy;

            var curWeek = weekOfYear(createLocal(), dow, doy);

            weekYear = defaults(w.gg, config._a[YEAR], curWeek.year);

            // Default to current week.
            week = defaults(w.w, curWeek.week);

            if (w.d != null) {
                // weekday -- low day numbers are considered next week
                weekday = w.d;
                if (weekday < 0 || weekday > 6) {
                    weekdayOverflow = true;
                }
            } else if (w.e != null) {
                // local weekday -- counting starts from beginning of week
                weekday = w.e + dow;
                if (w.e < 0 || w.e > 6) {
                    weekdayOverflow = true;
                }
            } else {
                // default to beginning of week
                weekday = dow;
            }
        }
        if (week < 1 || week > weeksInYear(weekYear, dow, doy)) {
            getParsingFlags(config)._overflowWeeks = true;
        } else if (weekdayOverflow != null) {
            getParsingFlags(config)._overflowWeekday = true;
        } else {
            temp = dayOfYearFromWeeks(weekYear, week, weekday, dow, doy);
            config._a[YEAR] = temp.year;
            config._dayOfYear = temp.dayOfYear;
        }
    }

    // iso 8601 regex
    // 0000-00-00 0000-W00 or 0000-W00-0 + T + 00 or 00:00 or 00:00:00 or 00:00:00.000 + +00:00 or +0000 or +00)
    var extendedIsoRegex = /^\s*((?:[+-]\d{6}|\d{4})-(?:\d\d-\d\d|W\d\d-\d|W\d\d|\d\d\d|\d\d))(?:(T| )(\d\d(?::\d\d(?::\d\d(?:[.,]\d+)?)?)?)([\+\-]\d\d(?::?\d\d)?|\s*Z)?)?$/;
    var basicIsoRegex = /^\s*((?:[+-]\d{6}|\d{4})(?:\d\d\d\d|W\d\d\d|W\d\d|\d\d\d|\d\d))(?:(T| )(\d\d(?:\d\d(?:\d\d(?:[.,]\d+)?)?)?)([\+\-]\d\d(?::?\d\d)?|\s*Z)?)?$/;

    var tzRegex = /Z|[+-]\d\d(?::?\d\d)?/;

    var isoDates = [
        ['YYYYYY-MM-DD', /[+-]\d{6}-\d\d-\d\d/],
        ['YYYY-MM-DD', /\d{4}-\d\d-\d\d/],
        ['GGGG-[W]WW-E', /\d{4}-W\d\d-\d/],
        ['GGGG-[W]WW', /\d{4}-W\d\d/, false],
        ['YYYY-DDD', /\d{4}-\d{3}/],
        ['YYYY-MM', /\d{4}-\d\d/, false],
        ['YYYYYYMMDD', /[+-]\d{10}/],
        ['YYYYMMDD', /\d{8}/],
        // YYYYMM is NOT allowed by the standard
        ['GGGG[W]WWE', /\d{4}W\d{3}/],
        ['GGGG[W]WW', /\d{4}W\d{2}/, false],
        ['YYYYDDD', /\d{7}/]
    ];

    // iso time formats and regexes
    var isoTimes = [
        ['HH:mm:ss.SSSS', /\d\d:\d\d:\d\d\.\d+/],
        ['HH:mm:ss,SSSS', /\d\d:\d\d:\d\d,\d+/],
        ['HH:mm:ss', /\d\d:\d\d:\d\d/],
        ['HH:mm', /\d\d:\d\d/],
        ['HHmmss.SSSS', /\d\d\d\d\d\d\.\d+/],
        ['HHmmss,SSSS', /\d\d\d\d\d\d,\d+/],
        ['HHmmss', /\d\d\d\d\d\d/],
        ['HHmm', /\d\d\d\d/],
        ['HH', /\d\d/]
    ];

    var aspNetJsonRegex = /^\/?Date\((\-?\d+)/i;

    // date from iso format
    function configFromISO(config) {
        var i, l,
            string = config._i,
            match = extendedIsoRegex.exec(string) || basicIsoRegex.exec(string),
            allowTime, dateFormat, timeFormat, tzFormat;

        if (match) {
            getParsingFlags(config).iso = true;

            for (i = 0, l = isoDates.length; i < l; i++) {
                if (isoDates[i][1].exec(match[1])) {
                    dateFormat = isoDates[i][0];
                    allowTime = isoDates[i][2] !== false;
                    break;
                }
            }
            if (dateFormat == null) {
                config._isValid = false;
                return;
            }
            if (match[3]) {
                for (i = 0, l = isoTimes.length; i < l; i++) {
                    if (isoTimes[i][1].exec(match[3])) {
                        // match[2] should be 'T' or space
                        timeFormat = (match[2] || ' ') + isoTimes[i][0];
                        break;
                    }
                }
                if (timeFormat == null) {
                    config._isValid = false;
                    return;
                }
            }
            if (!allowTime && timeFormat != null) {
                config._isValid = false;
                return;
            }
            if (match[4]) {
                if (tzRegex.exec(match[4])) {
                    tzFormat = 'Z';
                } else {
                    config._isValid = false;
                    return;
                }
            }
            config._f = dateFormat + (timeFormat || '') + (tzFormat || '');
            configFromStringAndFormat(config);
        } else {
            config._isValid = false;
        }
    }

    // RFC 2822 regex: For details see https://tools.ietf.org/html/rfc2822#section-3.3
    var rfc2822 = /^(?:(Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s)?(\d{1,2})\s(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s(\d{2,4})\s(\d\d):(\d\d)(?::(\d\d))?\s(?:(UT|GMT|[ECMP][SD]T)|([Zz])|([+-]\d{4}))$/;

    function extractFromRFC2822Strings(yearStr, monthStr, dayStr, hourStr, minuteStr, secondStr) {
        var result = [
            untruncateYear(yearStr),
            defaultLocaleMonthsShort.indexOf(monthStr),
            parseInt(dayStr, 10),
            parseInt(hourStr, 10),
            parseInt(minuteStr, 10)
        ];

        if (secondStr) {
            result.push(parseInt(secondStr, 10));
        }

        return result;
    }

    function untruncateYear(yearStr) {
        var year = parseInt(yearStr, 10);
        if (year <= 49) {
            return 2000 + year;
        } else if (year <= 999) {
            return 1900 + year;
        }
        return year;
    }

    function preprocessRFC2822(s) {
        // Remove comments and folding whitespace and replace multiple-spaces with a single space
        return s.replace(/\([^)]*\)|[\n\t]/g, ' ').replace(/(\s\s+)/g, ' ').replace(/^\s\s*/, '').replace(/\s\s*$/, '');
    }

    function checkWeekday(weekdayStr, parsedInput, config) {
        if (weekdayStr) {
            // TODO: Replace the vanilla JS Date object with an indepentent day-of-week check.
            var weekdayProvided = defaultLocaleWeekdaysShort.indexOf(weekdayStr),
                weekdayActual = new Date(parsedInput[0], parsedInput[1], parsedInput[2]).getDay();
            if (weekdayProvided !== weekdayActual) {
                getParsingFlags(config).weekdayMismatch = true;
                config._isValid = false;
                return false;
            }
        }
        return true;
    }

    var obsOffsets = {
        UT: 0,
        GMT: 0,
        EDT: -4 * 60,
        EST: -5 * 60,
        CDT: -5 * 60,
        CST: -6 * 60,
        MDT: -6 * 60,
        MST: -7 * 60,
        PDT: -7 * 60,
        PST: -8 * 60
    };

    function calculateOffset(obsOffset, militaryOffset, numOffset) {
        if (obsOffset) {
            return obsOffsets[obsOffset];
        } else if (militaryOffset) {
            // the only allowed military tz is Z
            return 0;
        } else {
            var hm = parseInt(numOffset, 10);
            var m = hm % 100, h = (hm - m) / 100;
            return h * 60 + m;
        }
    }

    // date and time from ref 2822 format
    function configFromRFC2822(config) {
        var match = rfc2822.exec(preprocessRFC2822(config._i));
        if (match) {
            var parsedArray = extractFromRFC2822Strings(match[4], match[3], match[2], match[5], match[6], match[7]);
            if (!checkWeekday(match[1], parsedArray, config)) {
                return;
            }

            config._a = parsedArray;
            config._tzm = calculateOffset(match[8], match[9], match[10]);

            config._d = createUTCDate.apply(null, config._a);
            config._d.setUTCMinutes(config._d.getUTCMinutes() - config._tzm);

            getParsingFlags(config).rfc2822 = true;
        } else {
            config._isValid = false;
        }
    }

    // date from iso format or fallback
    function configFromString(config) {
        var matched = aspNetJsonRegex.exec(config._i);

        if (matched !== null) {
            config._d = new Date(+matched[1]);
            return;
        }

        configFromISO(config);
        if (config._isValid === false) {
            delete config._isValid;
        } else {
            return;
        }

        configFromRFC2822(config);
        if (config._isValid === false) {
            delete config._isValid;
        } else {
            return;
        }

        // Final attempt, use Input Fallback
        hooks.createFromInputFallback(config);
    }

    hooks.createFromInputFallback = deprecate(
        'value provided is not in a recognized RFC2822 or ISO format. moment construction falls back to js Date(), ' +
        'which is not reliable across all browsers and versions. Non RFC2822/ISO date formats are ' +
        'discouraged and will be removed in an upcoming major release. Please refer to ' +
        'http://momentjs.com/guides/#/warnings/js-date/ for more info.',
        function (config) {
            config._d = new Date(config._i + (config._useUTC ? ' UTC' : ''));
        }
    );

    // constant that refers to the ISO standard
    hooks.ISO_8601 = function () {};

    // constant that refers to the RFC 2822 form
    hooks.RFC_2822 = function () {};

    // date from string and format string
    function configFromStringAndFormat(config) {
        // TODO: Move this to another part of the creation flow to prevent circular deps
        if (config._f === hooks.ISO_8601) {
            configFromISO(config);
            return;
        }
        if (config._f === hooks.RFC_2822) {
            configFromRFC2822(config);
            return;
        }
        config._a = [];
        getParsingFlags(config).empty = true;

        // This array is used to make a Date, either with `new Date` or `Date.UTC`
        var string = '' + config._i,
            i, parsedInput, tokens, token, skipped,
            stringLength = string.length,
            totalParsedInputLength = 0;

        tokens = expandFormat(config._f, config._locale).match(formattingTokens) || [];

        for (i = 0; i < tokens.length; i++) {
            token = tokens[i];
            parsedInput = (string.match(getParseRegexForToken(token, config)) || [])[0];
            // console.log('token', token, 'parsedInput', parsedInput,
            //         'regex', getParseRegexForToken(token, config));
            if (parsedInput) {
                skipped = string.substr(0, string.indexOf(parsedInput));
                if (skipped.length > 0) {
                    getParsingFlags(config).unusedInput.push(skipped);
                }
                string = string.slice(string.indexOf(parsedInput) + parsedInput.length);
                totalParsedInputLength += parsedInput.length;
            }
            // don't parse if it's not a known token
            if (formatTokenFunctions[token]) {
                if (parsedInput) {
                    getParsingFlags(config).empty = false;
                }
                else {
                    getParsingFlags(config).unusedTokens.push(token);
                }
                addTimeToArrayFromToken(token, parsedInput, config);
            }
            else if (config._strict && !parsedInput) {
                getParsingFlags(config).unusedTokens.push(token);
            }
        }

        // add remaining unparsed input length to the string
        getParsingFlags(config).charsLeftOver = stringLength - totalParsedInputLength;
        if (string.length > 0) {
            getParsingFlags(config).unusedInput.push(string);
        }

        // clear _12h flag if hour is <= 12
        if (config._a[HOUR] <= 12 &&
            getParsingFlags(config).bigHour === true &&
            config._a[HOUR] > 0) {
            getParsingFlags(config).bigHour = undefined;
        }

        getParsingFlags(config).parsedDateParts = config._a.slice(0);
        getParsingFlags(config).meridiem = config._meridiem;
        // handle meridiem
        config._a[HOUR] = meridiemFixWrap(config._locale, config._a[HOUR], config._meridiem);

        configFromArray(config);
        checkOverflow(config);
    }


    function meridiemFixWrap (locale, hour, meridiem) {
        var isPm;

        if (meridiem == null) {
            // nothing to do
            return hour;
        }
        if (locale.meridiemHour != null) {
            return locale.meridiemHour(hour, meridiem);
        } else if (locale.isPM != null) {
            // Fallback
            isPm = locale.isPM(meridiem);
            if (isPm && hour < 12) {
                hour += 12;
            }
            if (!isPm && hour === 12) {
                hour = 0;
            }
            return hour;
        } else {
            // this is not supposed to happen
            return hour;
        }
    }

    // date from string and array of format strings
    function configFromStringAndArray(config) {
        var tempConfig,
            bestMoment,

            scoreToBeat,
            i,
            currentScore;

        if (config._f.length === 0) {
            getParsingFlags(config).invalidFormat = true;
            config._d = new Date(NaN);
            return;
        }

        for (i = 0; i < config._f.length; i++) {
            currentScore = 0;
            tempConfig = copyConfig({}, config);
            if (config._useUTC != null) {
                tempConfig._useUTC = config._useUTC;
            }
            tempConfig._f = config._f[i];
            configFromStringAndFormat(tempConfig);

            if (!isValid(tempConfig)) {
                continue;
            }

            // if there is any input that was not parsed add a penalty for that format
            currentScore += getParsingFlags(tempConfig).charsLeftOver;

            //or tokens
            currentScore += getParsingFlags(tempConfig).unusedTokens.length * 10;

            getParsingFlags(tempConfig).score = currentScore;

            if (scoreToBeat == null || currentScore < scoreToBeat) {
                scoreToBeat = currentScore;
                bestMoment = tempConfig;
            }
        }

        extend(config, bestMoment || tempConfig);
    }

    function configFromObject(config) {
        if (config._d) {
            return;
        }

        var i = normalizeObjectUnits(config._i);
        config._a = map([i.year, i.month, i.day || i.date, i.hour, i.minute, i.second, i.millisecond], function (obj) {
            return obj && parseInt(obj, 10);
        });

        configFromArray(config);
    }

    function createFromConfig (config) {
        var res = new Moment(checkOverflow(prepareConfig(config)));
        if (res._nextDay) {
            // Adding is smart enough around DST
            res.add(1, 'd');
            res._nextDay = undefined;
        }

        return res;
    }

    function prepareConfig (config) {
        var input = config._i,
            format = config._f;

        config._locale = config._locale || getLocale(config._l);

        if (input === null || (format === undefined && input === '')) {
            return createInvalid({nullInput: true});
        }

        if (typeof input === 'string') {
            config._i = input = config._locale.preparse(input);
        }

        if (isMoment(input)) {
            return new Moment(checkOverflow(input));
        } else if (isDate(input)) {
            config._d = input;
        } else if (isArray(format)) {
            configFromStringAndArray(config);
        } else if (format) {
            configFromStringAndFormat(config);
        }  else {
            configFromInput(config);
        }

        if (!isValid(config)) {
            config._d = null;
        }

        return config;
    }

    function configFromInput(config) {
        var input = config._i;
        if (isUndefined(input)) {
            config._d = new Date(hooks.now());
        } else if (isDate(input)) {
            config._d = new Date(input.valueOf());
        } else if (typeof input === 'string') {
            configFromString(config);
        } else if (isArray(input)) {
            config._a = map(input.slice(0), function (obj) {
                return parseInt(obj, 10);
            });
            configFromArray(config);
        } else if (isObject(input)) {
            configFromObject(config);
        } else if (isNumber(input)) {
            // from milliseconds
            config._d = new Date(input);
        } else {
            hooks.createFromInputFallback(config);
        }
    }

    function createLocalOrUTC (input, format, locale, strict, isUTC) {
        var c = {};

        if (locale === true || locale === false) {
            strict = locale;
            locale = undefined;
        }

        if ((isObject(input) && isObjectEmpty(input)) ||
                (isArray(input) && input.length === 0)) {
            input = undefined;
        }
        // object construction must be done this way.
        // https://github.com/moment/moment/issues/1423
        c._isAMomentObject = true;
        c._useUTC = c._isUTC = isUTC;
        c._l = locale;
        c._i = input;
        c._f = format;
        c._strict = strict;

        return createFromConfig(c);
    }

    function createLocal (input, format, locale, strict) {
        return createLocalOrUTC(input, format, locale, strict, false);
    }

    var prototypeMin = deprecate(
        'moment().min is deprecated, use moment.max instead. http://momentjs.com/guides/#/warnings/min-max/',
        function () {
            var other = createLocal.apply(null, arguments);
            if (this.isValid() && other.isValid()) {
                return other < this ? this : other;
            } else {
                return createInvalid();
            }
        }
    );

    var prototypeMax = deprecate(
        'moment().max is deprecated, use moment.min instead. http://momentjs.com/guides/#/warnings/min-max/',
        function () {
            var other = createLocal.apply(null, arguments);
            if (this.isValid() && other.isValid()) {
                return other > this ? this : other;
            } else {
                return createInvalid();
            }
        }
    );

    // Pick a moment m from moments so that m[fn](other) is true for all
    // other. This relies on the function fn to be transitive.
    //
    // moments should either be an array of moment objects or an array, whose
    // first element is an array of moment objects.
    function pickBy(fn, moments) {
        var res, i;
        if (moments.length === 1 && isArray(moments[0])) {
            moments = moments[0];
        }
        if (!moments.length) {
            return createLocal();
        }
        res = moments[0];
        for (i = 1; i < moments.length; ++i) {
            if (!moments[i].isValid() || moments[i][fn](res)) {
                res = moments[i];
            }
        }
        return res;
    }

    // TODO: Use [].sort instead?
    function min () {
        var args = [].slice.call(arguments, 0);

        return pickBy('isBefore', args);
    }

    function max () {
        var args = [].slice.call(arguments, 0);

        return pickBy('isAfter', args);
    }

    var now = function () {
        return Date.now ? Date.now() : +(new Date());
    };

    var ordering = ['year', 'quarter', 'month', 'week', 'day', 'hour', 'minute', 'second', 'millisecond'];

    function isDurationValid(m) {
        for (var key in m) {
            if (!(indexOf.call(ordering, key) !== -1 && (m[key] == null || !isNaN(m[key])))) {
                return false;
            }
        }

        var unitHasDecimal = false;
        for (var i = 0; i < ordering.length; ++i) {
            if (m[ordering[i]]) {
                if (unitHasDecimal) {
                    return false; // only allow non-integers for smallest unit
                }
                if (parseFloat(m[ordering[i]]) !== toInt(m[ordering[i]])) {
                    unitHasDecimal = true;
                }
            }
        }

        return true;
    }

    function isValid$1() {
        return this._isValid;
    }

    function createInvalid$1() {
        return createDuration(NaN);
    }

    function Duration (duration) {
        var normalizedInput = normalizeObjectUnits(duration),
            years = normalizedInput.year || 0,
            quarters = normalizedInput.quarter || 0,
            months = normalizedInput.month || 0,
            weeks = normalizedInput.week || normalizedInput.isoWeek || 0,
            days = normalizedInput.day || 0,
            hours = normalizedInput.hour || 0,
            minutes = normalizedInput.minute || 0,
            seconds = normalizedInput.second || 0,
            milliseconds = normalizedInput.millisecond || 0;

        this._isValid = isDurationValid(normalizedInput);

        // representation for dateAddRemove
        this._milliseconds = +milliseconds +
            seconds * 1e3 + // 1000
            minutes * 6e4 + // 1000 * 60
            hours * 1000 * 60 * 60; //using 1000 * 60 * 60 instead of 36e5 to avoid floating point rounding errors https://github.com/moment/moment/issues/2978
        // Because of dateAddRemove treats 24 hours as different from a
        // day when working around DST, we need to store them separately
        this._days = +days +
            weeks * 7;
        // It is impossible to translate months into days without knowing
        // which months you are are talking about, so we have to store
        // it separately.
        this._months = +months +
            quarters * 3 +
            years * 12;

        this._data = {};

        this._locale = getLocale();

        this._bubble();
    }

    function isDuration (obj) {
        return obj instanceof Duration;
    }

    function absRound (number) {
        if (number < 0) {
            return Math.round(-1 * number) * -1;
        } else {
            return Math.round(number);
        }
    }

    // FORMATTING

    function offset (token, separator) {
        addFormatToken(token, 0, 0, function () {
            var offset = this.utcOffset();
            var sign = '+';
            if (offset < 0) {
                offset = -offset;
                sign = '-';
            }
            return sign + zeroFill(~~(offset / 60), 2) + separator + zeroFill(~~(offset) % 60, 2);
        });
    }

    offset('Z', ':');
    offset('ZZ', '');

    // PARSING

    addRegexToken('Z',  matchShortOffset);
    addRegexToken('ZZ', matchShortOffset);
    addParseToken(['Z', 'ZZ'], function (input, array, config) {
        config._useUTC = true;
        config._tzm = offsetFromString(matchShortOffset, input);
    });

    // HELPERS

    // timezone chunker
    // '+10:00' > ['10',  '00']
    // '-1530'  > ['-15', '30']
    var chunkOffset = /([\+\-]|\d\d)/gi;

    function offsetFromString(matcher, string) {
        var matches = (string || '').match(matcher);

        if (matches === null) {
            return null;
        }

        var chunk   = matches[matches.length - 1] || [];
        var parts   = (chunk + '').match(chunkOffset) || ['-', 0, 0];
        var minutes = +(parts[1] * 60) + toInt(parts[2]);

        return minutes === 0 ?
          0 :
          parts[0] === '+' ? minutes : -minutes;
    }

    // Return a moment from input, that is local/utc/zone equivalent to model.
    function cloneWithOffset(input, model) {
        var res, diff;
        if (model._isUTC) {
            res = model.clone();
            diff = (isMoment(input) || isDate(input) ? input.valueOf() : createLocal(input).valueOf()) - res.valueOf();
            // Use low-level api, because this fn is low-level api.
            res._d.setTime(res._d.valueOf() + diff);
            hooks.updateOffset(res, false);
            return res;
        } else {
            return createLocal(input).local();
        }
    }

    function getDateOffset (m) {
        // On Firefox.24 Date#getTimezoneOffset returns a floating point.
        // https://github.com/moment/moment/pull/1871
        return -Math.round(m._d.getTimezoneOffset() / 15) * 15;
    }

    // HOOKS

    // This function will be called whenever a moment is mutated.
    // It is intended to keep the offset in sync with the timezone.
    hooks.updateOffset = function () {};

    // MOMENTS

    // keepLocalTime = true means only change the timezone, without
    // affecting the local hour. So 5:31:26 +0300 --[utcOffset(2, true)]-->
    // 5:31:26 +0200 It is possible that 5:31:26 doesn't exist with offset
    // +0200, so we adjust the time as needed, to be valid.
    //
    // Keeping the time actually adds/subtracts (one hour)
    // from the actual represented time. That is why we call updateOffset
    // a second time. In case it wants us to change the offset again
    // _changeInProgress == true case, then we have to adjust, because
    // there is no such time in the given timezone.
    function getSetOffset (input, keepLocalTime, keepMinutes) {
        var offset = this._offset || 0,
            localAdjust;
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }
        if (input != null) {
            if (typeof input === 'string') {
                input = offsetFromString(matchShortOffset, input);
                if (input === null) {
                    return this;
                }
            } else if (Math.abs(input) < 16 && !keepMinutes) {
                input = input * 60;
            }
            if (!this._isUTC && keepLocalTime) {
                localAdjust = getDateOffset(this);
            }
            this._offset = input;
            this._isUTC = true;
            if (localAdjust != null) {
                this.add(localAdjust, 'm');
            }
            if (offset !== input) {
                if (!keepLocalTime || this._changeInProgress) {
                    addSubtract(this, createDuration(input - offset, 'm'), 1, false);
                } else if (!this._changeInProgress) {
                    this._changeInProgress = true;
                    hooks.updateOffset(this, true);
                    this._changeInProgress = null;
                }
            }
            return this;
        } else {
            return this._isUTC ? offset : getDateOffset(this);
        }
    }

    function getSetZone (input, keepLocalTime) {
        if (input != null) {
            if (typeof input !== 'string') {
                input = -input;
            }

            this.utcOffset(input, keepLocalTime);

            return this;
        } else {
            return -this.utcOffset();
        }
    }

    function setOffsetToUTC (keepLocalTime) {
        return this.utcOffset(0, keepLocalTime);
    }

    function setOffsetToLocal (keepLocalTime) {
        if (this._isUTC) {
            this.utcOffset(0, keepLocalTime);
            this._isUTC = false;

            if (keepLocalTime) {
                this.subtract(getDateOffset(this), 'm');
            }
        }
        return this;
    }

    function setOffsetToParsedOffset () {
        if (this._tzm != null) {
            this.utcOffset(this._tzm, false, true);
        } else if (typeof this._i === 'string') {
            var tZone = offsetFromString(matchOffset, this._i);
            if (tZone != null) {
                this.utcOffset(tZone);
            }
            else {
                this.utcOffset(0, true);
            }
        }
        return this;
    }

    function hasAlignedHourOffset (input) {
        if (!this.isValid()) {
            return false;
        }
        input = input ? createLocal(input).utcOffset() : 0;

        return (this.utcOffset() - input) % 60 === 0;
    }

    function isDaylightSavingTime () {
        return (
            this.utcOffset() > this.clone().month(0).utcOffset() ||
            this.utcOffset() > this.clone().month(5).utcOffset()
        );
    }

    function isDaylightSavingTimeShifted () {
        if (!isUndefined(this._isDSTShifted)) {
            return this._isDSTShifted;
        }

        var c = {};

        copyConfig(c, this);
        c = prepareConfig(c);

        if (c._a) {
            var other = c._isUTC ? createUTC(c._a) : createLocal(c._a);
            this._isDSTShifted = this.isValid() &&
                compareArrays(c._a, other.toArray()) > 0;
        } else {
            this._isDSTShifted = false;
        }

        return this._isDSTShifted;
    }

    function isLocal () {
        return this.isValid() ? !this._isUTC : false;
    }

    function isUtcOffset () {
        return this.isValid() ? this._isUTC : false;
    }

    function isUtc () {
        return this.isValid() ? this._isUTC && this._offset === 0 : false;
    }

    // ASP.NET json date format regex
    var aspNetRegex = /^(\-|\+)?(?:(\d*)[. ])?(\d+)\:(\d+)(?:\:(\d+)(\.\d*)?)?$/;

    // from http://docs.closure-library.googlecode.com/git/closure_goog_date_date.js.source.html
    // somewhat more in line with 4.4.3.2 2004 spec, but allows decimal anywhere
    // and further modified to allow for strings containing both week and day
    var isoRegex = /^(-|\+)?P(?:([-+]?[0-9,.]*)Y)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)W)?(?:([-+]?[0-9,.]*)D)?(?:T(?:([-+]?[0-9,.]*)H)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)S)?)?$/;

    function createDuration (input, key) {
        var duration = input,
            // matching against regexp is expensive, do it on demand
            match = null,
            sign,
            ret,
            diffRes;

        if (isDuration(input)) {
            duration = {
                ms : input._milliseconds,
                d  : input._days,
                M  : input._months
            };
        } else if (isNumber(input)) {
            duration = {};
            if (key) {
                duration[key] = input;
            } else {
                duration.milliseconds = input;
            }
        } else if (!!(match = aspNetRegex.exec(input))) {
            sign = (match[1] === '-') ? -1 : 1;
            duration = {
                y  : 0,
                d  : toInt(match[DATE])                         * sign,
                h  : toInt(match[HOUR])                         * sign,
                m  : toInt(match[MINUTE])                       * sign,
                s  : toInt(match[SECOND])                       * sign,
                ms : toInt(absRound(match[MILLISECOND] * 1000)) * sign // the millisecond decimal point is included in the match
            };
        } else if (!!(match = isoRegex.exec(input))) {
            sign = (match[1] === '-') ? -1 : 1;
            duration = {
                y : parseIso(match[2], sign),
                M : parseIso(match[3], sign),
                w : parseIso(match[4], sign),
                d : parseIso(match[5], sign),
                h : parseIso(match[6], sign),
                m : parseIso(match[7], sign),
                s : parseIso(match[8], sign)
            };
        } else if (duration == null) {// checks for null or undefined
            duration = {};
        } else if (typeof duration === 'object' && ('from' in duration || 'to' in duration)) {
            diffRes = momentsDifference(createLocal(duration.from), createLocal(duration.to));

            duration = {};
            duration.ms = diffRes.milliseconds;
            duration.M = diffRes.months;
        }

        ret = new Duration(duration);

        if (isDuration(input) && hasOwnProp(input, '_locale')) {
            ret._locale = input._locale;
        }

        return ret;
    }

    createDuration.fn = Duration.prototype;
    createDuration.invalid = createInvalid$1;

    function parseIso (inp, sign) {
        // We'd normally use ~~inp for this, but unfortunately it also
        // converts floats to ints.
        // inp may be undefined, so careful calling replace on it.
        var res = inp && parseFloat(inp.replace(',', '.'));
        // apply sign while we're at it
        return (isNaN(res) ? 0 : res) * sign;
    }

    function positiveMomentsDifference(base, other) {
        var res = {};

        res.months = other.month() - base.month() +
            (other.year() - base.year()) * 12;
        if (base.clone().add(res.months, 'M').isAfter(other)) {
            --res.months;
        }

        res.milliseconds = +other - +(base.clone().add(res.months, 'M'));

        return res;
    }

    function momentsDifference(base, other) {
        var res;
        if (!(base.isValid() && other.isValid())) {
            return {milliseconds: 0, months: 0};
        }

        other = cloneWithOffset(other, base);
        if (base.isBefore(other)) {
            res = positiveMomentsDifference(base, other);
        } else {
            res = positiveMomentsDifference(other, base);
            res.milliseconds = -res.milliseconds;
            res.months = -res.months;
        }

        return res;
    }

    // TODO: remove 'name' arg after deprecation is removed
    function createAdder(direction, name) {
        return function (val, period) {
            var dur, tmp;
            //invert the arguments, but complain about it
            if (period !== null && !isNaN(+period)) {
                deprecateSimple(name, 'moment().' + name  + '(period, number) is deprecated. Please use moment().' + name + '(number, period). ' +
                'See http://momentjs.com/guides/#/warnings/add-inverted-param/ for more info.');
                tmp = val; val = period; period = tmp;
            }

            val = typeof val === 'string' ? +val : val;
            dur = createDuration(val, period);
            addSubtract(this, dur, direction);
            return this;
        };
    }

    function addSubtract (mom, duration, isAdding, updateOffset) {
        var milliseconds = duration._milliseconds,
            days = absRound(duration._days),
            months = absRound(duration._months);

        if (!mom.isValid()) {
            // No op
            return;
        }

        updateOffset = updateOffset == null ? true : updateOffset;

        if (months) {
            setMonth(mom, get(mom, 'Month') + months * isAdding);
        }
        if (days) {
            set$1(mom, 'Date', get(mom, 'Date') + days * isAdding);
        }
        if (milliseconds) {
            mom._d.setTime(mom._d.valueOf() + milliseconds * isAdding);
        }
        if (updateOffset) {
            hooks.updateOffset(mom, days || months);
        }
    }

    var add      = createAdder(1, 'add');
    var subtract = createAdder(-1, 'subtract');

    function getCalendarFormat(myMoment, now) {
        var diff = myMoment.diff(now, 'days', true);
        return diff < -6 ? 'sameElse' :
                diff < -1 ? 'lastWeek' :
                diff < 0 ? 'lastDay' :
                diff < 1 ? 'sameDay' :
                diff < 2 ? 'nextDay' :
                diff < 7 ? 'nextWeek' : 'sameElse';
    }

    function calendar$1 (time, formats) {
        // We want to compare the start of today, vs this.
        // Getting start-of-today depends on whether we're local/utc/offset or not.
        var now = time || createLocal(),
            sod = cloneWithOffset(now, this).startOf('day'),
            format = hooks.calendarFormat(this, sod) || 'sameElse';

        var output = formats && (isFunction(formats[format]) ? formats[format].call(this, now) : formats[format]);

        return this.format(output || this.localeData().calendar(format, this, createLocal(now)));
    }

    function clone () {
        return new Moment(this);
    }

    function isAfter (input, units) {
        var localInput = isMoment(input) ? input : createLocal(input);
        if (!(this.isValid() && localInput.isValid())) {
            return false;
        }
        units = normalizeUnits(units) || 'millisecond';
        if (units === 'millisecond') {
            return this.valueOf() > localInput.valueOf();
        } else {
            return localInput.valueOf() < this.clone().startOf(units).valueOf();
        }
    }

    function isBefore (input, units) {
        var localInput = isMoment(input) ? input : createLocal(input);
        if (!(this.isValid() && localInput.isValid())) {
            return false;
        }
        units = normalizeUnits(units) || 'millisecond';
        if (units === 'millisecond') {
            return this.valueOf() < localInput.valueOf();
        } else {
            return this.clone().endOf(units).valueOf() < localInput.valueOf();
        }
    }

    function isBetween (from, to, units, inclusivity) {
        var localFrom = isMoment(from) ? from : createLocal(from),
            localTo = isMoment(to) ? to : createLocal(to);
        if (!(this.isValid() && localFrom.isValid() && localTo.isValid())) {
            return false;
        }
        inclusivity = inclusivity || '()';
        return (inclusivity[0] === '(' ? this.isAfter(localFrom, units) : !this.isBefore(localFrom, units)) &&
            (inclusivity[1] === ')' ? this.isBefore(localTo, units) : !this.isAfter(localTo, units));
    }

    function isSame (input, units) {
        var localInput = isMoment(input) ? input : createLocal(input),
            inputMs;
        if (!(this.isValid() && localInput.isValid())) {
            return false;
        }
        units = normalizeUnits(units) || 'millisecond';
        if (units === 'millisecond') {
            return this.valueOf() === localInput.valueOf();
        } else {
            inputMs = localInput.valueOf();
            return this.clone().startOf(units).valueOf() <= inputMs && inputMs <= this.clone().endOf(units).valueOf();
        }
    }

    function isSameOrAfter (input, units) {
        return this.isSame(input, units) || this.isAfter(input, units);
    }

    function isSameOrBefore (input, units) {
        return this.isSame(input, units) || this.isBefore(input, units);
    }

    function diff (input, units, asFloat) {
        var that,
            zoneDelta,
            output;

        if (!this.isValid()) {
            return NaN;
        }

        that = cloneWithOffset(input, this);

        if (!that.isValid()) {
            return NaN;
        }

        zoneDelta = (that.utcOffset() - this.utcOffset()) * 6e4;

        units = normalizeUnits(units);

        switch (units) {
            case 'year': output = monthDiff(this, that) / 12; break;
            case 'month': output = monthDiff(this, that); break;
            case 'quarter': output = monthDiff(this, that) / 3; break;
            case 'second': output = (this - that) / 1e3; break; // 1000
            case 'minute': output = (this - that) / 6e4; break; // 1000 * 60
            case 'hour': output = (this - that) / 36e5; break; // 1000 * 60 * 60
            case 'day': output = (this - that - zoneDelta) / 864e5; break; // 1000 * 60 * 60 * 24, negate dst
            case 'week': output = (this - that - zoneDelta) / 6048e5; break; // 1000 * 60 * 60 * 24 * 7, negate dst
            default: output = this - that;
        }

        return asFloat ? output : absFloor(output);
    }

    function monthDiff (a, b) {
        // difference in months
        var wholeMonthDiff = ((b.year() - a.year()) * 12) + (b.month() - a.month()),
            // b is in (anchor - 1 month, anchor + 1 month)
            anchor = a.clone().add(wholeMonthDiff, 'months'),
            anchor2, adjust;

        if (b - anchor < 0) {
            anchor2 = a.clone().add(wholeMonthDiff - 1, 'months');
            // linear across the month
            adjust = (b - anchor) / (anchor - anchor2);
        } else {
            anchor2 = a.clone().add(wholeMonthDiff + 1, 'months');
            // linear across the month
            adjust = (b - anchor) / (anchor2 - anchor);
        }

        //check for negative zero, return zero if negative zero
        return -(wholeMonthDiff + adjust) || 0;
    }

    hooks.defaultFormat = 'YYYY-MM-DDTHH:mm:ssZ';
    hooks.defaultFormatUtc = 'YYYY-MM-DDTHH:mm:ss[Z]';

    function toString () {
        return this.clone().locale('en').format('ddd MMM DD YYYY HH:mm:ss [GMT]ZZ');
    }

    function toISOString(keepOffset) {
        if (!this.isValid()) {
            return null;
        }
        var utc = keepOffset !== true;
        var m = utc ? this.clone().utc() : this;
        if (m.year() < 0 || m.year() > 9999) {
            return formatMoment(m, utc ? 'YYYYYY-MM-DD[T]HH:mm:ss.SSS[Z]' : 'YYYYYY-MM-DD[T]HH:mm:ss.SSSZ');
        }
        if (isFunction(Date.prototype.toISOString)) {
            // native implementation is ~50x faster, use it when we can
            if (utc) {
                return this.toDate().toISOString();
            } else {
                return new Date(this.valueOf() + this.utcOffset() * 60 * 1000).toISOString().replace('Z', formatMoment(m, 'Z'));
            }
        }
        return formatMoment(m, utc ? 'YYYY-MM-DD[T]HH:mm:ss.SSS[Z]' : 'YYYY-MM-DD[T]HH:mm:ss.SSSZ');
    }

    /**
     * Return a human readable representation of a moment that can
     * also be evaluated to get a new moment which is the same
     *
     * @link https://nodejs.org/dist/latest/docs/api/util.html#util_custom_inspect_function_on_objects
     */
    function inspect () {
        if (!this.isValid()) {
            return 'moment.invalid(/* ' + this._i + ' */)';
        }
        var func = 'moment';
        var zone = '';
        if (!this.isLocal()) {
            func = this.utcOffset() === 0 ? 'moment.utc' : 'moment.parseZone';
            zone = 'Z';
        }
        var prefix = '[' + func + '("]';
        var year = (0 <= this.year() && this.year() <= 9999) ? 'YYYY' : 'YYYYYY';
        var datetime = '-MM-DD[T]HH:mm:ss.SSS';
        var suffix = zone + '[")]';

        return this.format(prefix + year + datetime + suffix);
    }

    function format (inputString) {
        if (!inputString) {
            inputString = this.isUtc() ? hooks.defaultFormatUtc : hooks.defaultFormat;
        }
        var output = formatMoment(this, inputString);
        return this.localeData().postformat(output);
    }

    function from (time, withoutSuffix) {
        if (this.isValid() &&
                ((isMoment(time) && time.isValid()) ||
                 createLocal(time).isValid())) {
            return createDuration({to: this, from: time}).locale(this.locale()).humanize(!withoutSuffix);
        } else {
            return this.localeData().invalidDate();
        }
    }

    function fromNow (withoutSuffix) {
        return this.from(createLocal(), withoutSuffix);
    }

    function to (time, withoutSuffix) {
        if (this.isValid() &&
                ((isMoment(time) && time.isValid()) ||
                 createLocal(time).isValid())) {
            return createDuration({from: this, to: time}).locale(this.locale()).humanize(!withoutSuffix);
        } else {
            return this.localeData().invalidDate();
        }
    }

    function toNow (withoutSuffix) {
        return this.to(createLocal(), withoutSuffix);
    }

    // If passed a locale key, it will set the locale for this
    // instance.  Otherwise, it will return the locale configuration
    // variables for this instance.
    function locale (key) {
        var newLocaleData;

        if (key === undefined) {
            return this._locale._abbr;
        } else {
            newLocaleData = getLocale(key);
            if (newLocaleData != null) {
                this._locale = newLocaleData;
            }
            return this;
        }
    }

    var lang = deprecate(
        'moment().lang() is deprecated. Instead, use moment().localeData() to get the language configuration. Use moment().locale() to change languages.',
        function (key) {
            if (key === undefined) {
                return this.localeData();
            } else {
                return this.locale(key);
            }
        }
    );

    function localeData () {
        return this._locale;
    }

    var MS_PER_SECOND = 1000;
    var MS_PER_MINUTE = 60 * MS_PER_SECOND;
    var MS_PER_HOUR = 60 * MS_PER_MINUTE;
    var MS_PER_400_YEARS = (365 * 400 + 97) * 24 * MS_PER_HOUR;

    // actual modulo - handles negative numbers (for dates before 1970):
    function mod$1(dividend, divisor) {
        return (dividend % divisor + divisor) % divisor;
    }

    function localStartOfDate(y, m, d) {
        // the date constructor remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0) {
            // preserve leap years using a full 400 year cycle, then reset
            return new Date(y + 400, m, d) - MS_PER_400_YEARS;
        } else {
            return new Date(y, m, d).valueOf();
        }
    }

    function utcStartOfDate(y, m, d) {
        // Date.UTC remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0) {
            // preserve leap years using a full 400 year cycle, then reset
            return Date.UTC(y + 400, m, d) - MS_PER_400_YEARS;
        } else {
            return Date.UTC(y, m, d);
        }
    }

    function startOf (units) {
        var time;
        units = normalizeUnits(units);
        if (units === undefined || units === 'millisecond' || !this.isValid()) {
            return this;
        }

        var startOfDate = this._isUTC ? utcStartOfDate : localStartOfDate;

        switch (units) {
            case 'year':
                time = startOfDate(this.year(), 0, 1);
                break;
            case 'quarter':
                time = startOfDate(this.year(), this.month() - this.month() % 3, 1);
                break;
            case 'month':
                time = startOfDate(this.year(), this.month(), 1);
                break;
            case 'week':
                time = startOfDate(this.year(), this.month(), this.date() - this.weekday());
                break;
            case 'isoWeek':
                time = startOfDate(this.year(), this.month(), this.date() - (this.isoWeekday() - 1));
                break;
            case 'day':
            case 'date':
                time = startOfDate(this.year(), this.month(), this.date());
                break;
            case 'hour':
                time = this._d.valueOf();
                time -= mod$1(time + (this._isUTC ? 0 : this.utcOffset() * MS_PER_MINUTE), MS_PER_HOUR);
                break;
            case 'minute':
                time = this._d.valueOf();
                time -= mod$1(time, MS_PER_MINUTE);
                break;
            case 'second':
                time = this._d.valueOf();
                time -= mod$1(time, MS_PER_SECOND);
                break;
        }

        this._d.setTime(time);
        hooks.updateOffset(this, true);
        return this;
    }

    function endOf (units) {
        var time;
        units = normalizeUnits(units);
        if (units === undefined || units === 'millisecond' || !this.isValid()) {
            return this;
        }

        var startOfDate = this._isUTC ? utcStartOfDate : localStartOfDate;

        switch (units) {
            case 'year':
                time = startOfDate(this.year() + 1, 0, 1) - 1;
                break;
            case 'quarter':
                time = startOfDate(this.year(), this.month() - this.month() % 3 + 3, 1) - 1;
                break;
            case 'month':
                time = startOfDate(this.year(), this.month() + 1, 1) - 1;
                break;
            case 'week':
                time = startOfDate(this.year(), this.month(), this.date() - this.weekday() + 7) - 1;
                break;
            case 'isoWeek':
                time = startOfDate(this.year(), this.month(), this.date() - (this.isoWeekday() - 1) + 7) - 1;
                break;
            case 'day':
            case 'date':
                time = startOfDate(this.year(), this.month(), this.date() + 1) - 1;
                break;
            case 'hour':
                time = this._d.valueOf();
                time += MS_PER_HOUR - mod$1(time + (this._isUTC ? 0 : this.utcOffset() * MS_PER_MINUTE), MS_PER_HOUR) - 1;
                break;
            case 'minute':
                time = this._d.valueOf();
                time += MS_PER_MINUTE - mod$1(time, MS_PER_MINUTE) - 1;
                break;
            case 'second':
                time = this._d.valueOf();
                time += MS_PER_SECOND - mod$1(time, MS_PER_SECOND) - 1;
                break;
        }

        this._d.setTime(time);
        hooks.updateOffset(this, true);
        return this;
    }

    function valueOf () {
        return this._d.valueOf() - ((this._offset || 0) * 60000);
    }

    function unix () {
        return Math.floor(this.valueOf() / 1000);
    }

    function toDate () {
        return new Date(this.valueOf());
    }

    function toArray () {
        var m = this;
        return [m.year(), m.month(), m.date(), m.hour(), m.minute(), m.second(), m.millisecond()];
    }

    function toObject () {
        var m = this;
        return {
            years: m.year(),
            months: m.month(),
            date: m.date(),
            hours: m.hours(),
            minutes: m.minutes(),
            seconds: m.seconds(),
            milliseconds: m.milliseconds()
        };
    }

    function toJSON () {
        // new Date(NaN).toJSON() === null
        return this.isValid() ? this.toISOString() : null;
    }

    function isValid$2 () {
        return isValid(this);
    }

    function parsingFlags () {
        return extend({}, getParsingFlags(this));
    }

    function invalidAt () {
        return getParsingFlags(this).overflow;
    }

    function creationData() {
        return {
            input: this._i,
            format: this._f,
            locale: this._locale,
            isUTC: this._isUTC,
            strict: this._strict
        };
    }

    // FORMATTING

    addFormatToken(0, ['gg', 2], 0, function () {
        return this.weekYear() % 100;
    });

    addFormatToken(0, ['GG', 2], 0, function () {
        return this.isoWeekYear() % 100;
    });

    function addWeekYearFormatToken (token, getter) {
        addFormatToken(0, [token, token.length], 0, getter);
    }

    addWeekYearFormatToken('gggg',     'weekYear');
    addWeekYearFormatToken('ggggg',    'weekYear');
    addWeekYearFormatToken('GGGG',  'isoWeekYear');
    addWeekYearFormatToken('GGGGG', 'isoWeekYear');

    // ALIASES

    addUnitAlias('weekYear', 'gg');
    addUnitAlias('isoWeekYear', 'GG');

    // PRIORITY

    addUnitPriority('weekYear', 1);
    addUnitPriority('isoWeekYear', 1);


    // PARSING

    addRegexToken('G',      matchSigned);
    addRegexToken('g',      matchSigned);
    addRegexToken('GG',     match1to2, match2);
    addRegexToken('gg',     match1to2, match2);
    addRegexToken('GGGG',   match1to4, match4);
    addRegexToken('gggg',   match1to4, match4);
    addRegexToken('GGGGG',  match1to6, match6);
    addRegexToken('ggggg',  match1to6, match6);

    addWeekParseToken(['gggg', 'ggggg', 'GGGG', 'GGGGG'], function (input, week, config, token) {
        week[token.substr(0, 2)] = toInt(input);
    });

    addWeekParseToken(['gg', 'GG'], function (input, week, config, token) {
        week[token] = hooks.parseTwoDigitYear(input);
    });

    // MOMENTS

    function getSetWeekYear (input) {
        return getSetWeekYearHelper.call(this,
                input,
                this.week(),
                this.weekday(),
                this.localeData()._week.dow,
                this.localeData()._week.doy);
    }

    function getSetISOWeekYear (input) {
        return getSetWeekYearHelper.call(this,
                input, this.isoWeek(), this.isoWeekday(), 1, 4);
    }

    function getISOWeeksInYear () {
        return weeksInYear(this.year(), 1, 4);
    }

    function getWeeksInYear () {
        var weekInfo = this.localeData()._week;
        return weeksInYear(this.year(), weekInfo.dow, weekInfo.doy);
    }

    function getSetWeekYearHelper(input, week, weekday, dow, doy) {
        var weeksTarget;
        if (input == null) {
            return weekOfYear(this, dow, doy).year;
        } else {
            weeksTarget = weeksInYear(input, dow, doy);
            if (week > weeksTarget) {
                week = weeksTarget;
            }
            return setWeekAll.call(this, input, week, weekday, dow, doy);
        }
    }

    function setWeekAll(weekYear, week, weekday, dow, doy) {
        var dayOfYearData = dayOfYearFromWeeks(weekYear, week, weekday, dow, doy),
            date = createUTCDate(dayOfYearData.year, 0, dayOfYearData.dayOfYear);

        this.year(date.getUTCFullYear());
        this.month(date.getUTCMonth());
        this.date(date.getUTCDate());
        return this;
    }

    // FORMATTING

    addFormatToken('Q', 0, 'Qo', 'quarter');

    // ALIASES

    addUnitAlias('quarter', 'Q');

    // PRIORITY

    addUnitPriority('quarter', 7);

    // PARSING

    addRegexToken('Q', match1);
    addParseToken('Q', function (input, array) {
        array[MONTH] = (toInt(input) - 1) * 3;
    });

    // MOMENTS

    function getSetQuarter (input) {
        return input == null ? Math.ceil((this.month() + 1) / 3) : this.month((input - 1) * 3 + this.month() % 3);
    }

    // FORMATTING

    addFormatToken('D', ['DD', 2], 'Do', 'date');

    // ALIASES

    addUnitAlias('date', 'D');

    // PRIORITY
    addUnitPriority('date', 9);

    // PARSING

    addRegexToken('D',  match1to2);
    addRegexToken('DD', match1to2, match2);
    addRegexToken('Do', function (isStrict, locale) {
        // TODO: Remove "ordinalParse" fallback in next major release.
        return isStrict ?
          (locale._dayOfMonthOrdinalParse || locale._ordinalParse) :
          locale._dayOfMonthOrdinalParseLenient;
    });

    addParseToken(['D', 'DD'], DATE);
    addParseToken('Do', function (input, array) {
        array[DATE] = toInt(input.match(match1to2)[0]);
    });

    // MOMENTS

    var getSetDayOfMonth = makeGetSet('Date', true);

    // FORMATTING

    addFormatToken('DDD', ['DDDD', 3], 'DDDo', 'dayOfYear');

    // ALIASES

    addUnitAlias('dayOfYear', 'DDD');

    // PRIORITY
    addUnitPriority('dayOfYear', 4);

    // PARSING

    addRegexToken('DDD',  match1to3);
    addRegexToken('DDDD', match3);
    addParseToken(['DDD', 'DDDD'], function (input, array, config) {
        config._dayOfYear = toInt(input);
    });

    // HELPERS

    // MOMENTS

    function getSetDayOfYear (input) {
        var dayOfYear = Math.round((this.clone().startOf('day') - this.clone().startOf('year')) / 864e5) + 1;
        return input == null ? dayOfYear : this.add((input - dayOfYear), 'd');
    }

    // FORMATTING

    addFormatToken('m', ['mm', 2], 0, 'minute');

    // ALIASES

    addUnitAlias('minute', 'm');

    // PRIORITY

    addUnitPriority('minute', 14);

    // PARSING

    addRegexToken('m',  match1to2);
    addRegexToken('mm', match1to2, match2);
    addParseToken(['m', 'mm'], MINUTE);

    // MOMENTS

    var getSetMinute = makeGetSet('Minutes', false);

    // FORMATTING

    addFormatToken('s', ['ss', 2], 0, 'second');

    // ALIASES

    addUnitAlias('second', 's');

    // PRIORITY

    addUnitPriority('second', 15);

    // PARSING

    addRegexToken('s',  match1to2);
    addRegexToken('ss', match1to2, match2);
    addParseToken(['s', 'ss'], SECOND);

    // MOMENTS

    var getSetSecond = makeGetSet('Seconds', false);

    // FORMATTING

    addFormatToken('S', 0, 0, function () {
        return ~~(this.millisecond() / 100);
    });

    addFormatToken(0, ['SS', 2], 0, function () {
        return ~~(this.millisecond() / 10);
    });

    addFormatToken(0, ['SSS', 3], 0, 'millisecond');
    addFormatToken(0, ['SSSS', 4], 0, function () {
        return this.millisecond() * 10;
    });
    addFormatToken(0, ['SSSSS', 5], 0, function () {
        return this.millisecond() * 100;
    });
    addFormatToken(0, ['SSSSSS', 6], 0, function () {
        return this.millisecond() * 1000;
    });
    addFormatToken(0, ['SSSSSSS', 7], 0, function () {
        return this.millisecond() * 10000;
    });
    addFormatToken(0, ['SSSSSSSS', 8], 0, function () {
        return this.millisecond() * 100000;
    });
    addFormatToken(0, ['SSSSSSSSS', 9], 0, function () {
        return this.millisecond() * 1000000;
    });


    // ALIASES

    addUnitAlias('millisecond', 'ms');

    // PRIORITY

    addUnitPriority('millisecond', 16);

    // PARSING

    addRegexToken('S',    match1to3, match1);
    addRegexToken('SS',   match1to3, match2);
    addRegexToken('SSS',  match1to3, match3);

    var token;
    for (token = 'SSSS'; token.length <= 9; token += 'S') {
        addRegexToken(token, matchUnsigned);
    }

    function parseMs(input, array) {
        array[MILLISECOND] = toInt(('0.' + input) * 1000);
    }

    for (token = 'S'; token.length <= 9; token += 'S') {
        addParseToken(token, parseMs);
    }
    // MOMENTS

    var getSetMillisecond = makeGetSet('Milliseconds', false);

    // FORMATTING

    addFormatToken('z',  0, 0, 'zoneAbbr');
    addFormatToken('zz', 0, 0, 'zoneName');

    // MOMENTS

    function getZoneAbbr () {
        return this._isUTC ? 'UTC' : '';
    }

    function getZoneName () {
        return this._isUTC ? 'Coordinated Universal Time' : '';
    }

    var proto = Moment.prototype;

    proto.add               = add;
    proto.calendar          = calendar$1;
    proto.clone             = clone;
    proto.diff              = diff;
    proto.endOf             = endOf;
    proto.format            = format;
    proto.from              = from;
    proto.fromNow           = fromNow;
    proto.to                = to;
    proto.toNow             = toNow;
    proto.get               = stringGet;
    proto.invalidAt         = invalidAt;
    proto.isAfter           = isAfter;
    proto.isBefore          = isBefore;
    proto.isBetween         = isBetween;
    proto.isSame            = isSame;
    proto.isSameOrAfter     = isSameOrAfter;
    proto.isSameOrBefore    = isSameOrBefore;
    proto.isValid           = isValid$2;
    proto.lang              = lang;
    proto.locale            = locale;
    proto.localeData        = localeData;
    proto.max               = prototypeMax;
    proto.min               = prototypeMin;
    proto.parsingFlags      = parsingFlags;
    proto.set               = stringSet;
    proto.startOf           = startOf;
    proto.subtract          = subtract;
    proto.toArray           = toArray;
    proto.toObject          = toObject;
    proto.toDate            = toDate;
    proto.toISOString       = toISOString;
    proto.inspect           = inspect;
    proto.toJSON            = toJSON;
    proto.toString          = toString;
    proto.unix              = unix;
    proto.valueOf           = valueOf;
    proto.creationData      = creationData;
    proto.year       = getSetYear;
    proto.isLeapYear = getIsLeapYear;
    proto.weekYear    = getSetWeekYear;
    proto.isoWeekYear = getSetISOWeekYear;
    proto.quarter = proto.quarters = getSetQuarter;
    proto.month       = getSetMonth;
    proto.daysInMonth = getDaysInMonth;
    proto.week           = proto.weeks        = getSetWeek;
    proto.isoWeek        = proto.isoWeeks     = getSetISOWeek;
    proto.weeksInYear    = getWeeksInYear;
    proto.isoWeeksInYear = getISOWeeksInYear;
    proto.date       = getSetDayOfMonth;
    proto.day        = proto.days             = getSetDayOfWeek;
    proto.weekday    = getSetLocaleDayOfWeek;
    proto.isoWeekday = getSetISODayOfWeek;
    proto.dayOfYear  = getSetDayOfYear;
    proto.hour = proto.hours = getSetHour;
    proto.minute = proto.minutes = getSetMinute;
    proto.second = proto.seconds = getSetSecond;
    proto.millisecond = proto.milliseconds = getSetMillisecond;
    proto.utcOffset            = getSetOffset;
    proto.utc                  = setOffsetToUTC;
    proto.local                = setOffsetToLocal;
    proto.parseZone            = setOffsetToParsedOffset;
    proto.hasAlignedHourOffset = hasAlignedHourOffset;
    proto.isDST                = isDaylightSavingTime;
    proto.isLocal              = isLocal;
    proto.isUtcOffset          = isUtcOffset;
    proto.isUtc                = isUtc;
    proto.isUTC                = isUtc;
    proto.zoneAbbr = getZoneAbbr;
    proto.zoneName = getZoneName;
    proto.dates  = deprecate('dates accessor is deprecated. Use date instead.', getSetDayOfMonth);
    proto.months = deprecate('months accessor is deprecated. Use month instead', getSetMonth);
    proto.years  = deprecate('years accessor is deprecated. Use year instead', getSetYear);
    proto.zone   = deprecate('moment().zone is deprecated, use moment().utcOffset instead. http://momentjs.com/guides/#/warnings/zone/', getSetZone);
    proto.isDSTShifted = deprecate('isDSTShifted is deprecated. See http://momentjs.com/guides/#/warnings/dst-shifted/ for more information', isDaylightSavingTimeShifted);

    function createUnix (input) {
        return createLocal(input * 1000);
    }

    function createInZone () {
        return createLocal.apply(null, arguments).parseZone();
    }

    function preParsePostFormat (string) {
        return string;
    }

    var proto$1 = Locale.prototype;

    proto$1.calendar        = calendar;
    proto$1.longDateFormat  = longDateFormat;
    proto$1.invalidDate     = invalidDate;
    proto$1.ordinal         = ordinal;
    proto$1.preparse        = preParsePostFormat;
    proto$1.postformat      = preParsePostFormat;
    proto$1.relativeTime    = relativeTime;
    proto$1.pastFuture      = pastFuture;
    proto$1.set             = set;

    proto$1.months            =        localeMonths;
    proto$1.monthsShort       =        localeMonthsShort;
    proto$1.monthsParse       =        localeMonthsParse;
    proto$1.monthsRegex       = monthsRegex;
    proto$1.monthsShortRegex  = monthsShortRegex;
    proto$1.week = localeWeek;
    proto$1.firstDayOfYear = localeFirstDayOfYear;
    proto$1.firstDayOfWeek = localeFirstDayOfWeek;

    proto$1.weekdays       =        localeWeekdays;
    proto$1.weekdaysMin    =        localeWeekdaysMin;
    proto$1.weekdaysShort  =        localeWeekdaysShort;
    proto$1.weekdaysParse  =        localeWeekdaysParse;

    proto$1.weekdaysRegex       =        weekdaysRegex;
    proto$1.weekdaysShortRegex  =        weekdaysShortRegex;
    proto$1.weekdaysMinRegex    =        weekdaysMinRegex;

    proto$1.isPM = localeIsPM;
    proto$1.meridiem = localeMeridiem;

    function get$1 (format, index, field, setter) {
        var locale = getLocale();
        var utc = createUTC().set(setter, index);
        return locale[field](utc, format);
    }

    function listMonthsImpl (format, index, field) {
        if (isNumber(format)) {
            index = format;
            format = undefined;
        }

        format = format || '';

        if (index != null) {
            return get$1(format, index, field, 'month');
        }

        var i;
        var out = [];
        for (i = 0; i < 12; i++) {
            out[i] = get$1(format, i, field, 'month');
        }
        return out;
    }

    // ()
    // (5)
    // (fmt, 5)
    // (fmt)
    // (true)
    // (true, 5)
    // (true, fmt, 5)
    // (true, fmt)
    function listWeekdaysImpl (localeSorted, format, index, field) {
        if (typeof localeSorted === 'boolean') {
            if (isNumber(format)) {
                index = format;
                format = undefined;
            }

            format = format || '';
        } else {
            format = localeSorted;
            index = format;
            localeSorted = false;

            if (isNumber(format)) {
                index = format;
                format = undefined;
            }

            format = format || '';
        }

        var locale = getLocale(),
            shift = localeSorted ? locale._week.dow : 0;

        if (index != null) {
            return get$1(format, (index + shift) % 7, field, 'day');
        }

        var i;
        var out = [];
        for (i = 0; i < 7; i++) {
            out[i] = get$1(format, (i + shift) % 7, field, 'day');
        }
        return out;
    }

    function listMonths (format, index) {
        return listMonthsImpl(format, index, 'months');
    }

    function listMonthsShort (format, index) {
        return listMonthsImpl(format, index, 'monthsShort');
    }

    function listWeekdays (localeSorted, format, index) {
        return listWeekdaysImpl(localeSorted, format, index, 'weekdays');
    }

    function listWeekdaysShort (localeSorted, format, index) {
        return listWeekdaysImpl(localeSorted, format, index, 'weekdaysShort');
    }

    function listWeekdaysMin (localeSorted, format, index) {
        return listWeekdaysImpl(localeSorted, format, index, 'weekdaysMin');
    }

    getSetGlobalLocale('en', {
        dayOfMonthOrdinalParse: /\d{1,2}(th|st|nd|rd)/,
        ordinal : function (number) {
            var b = number % 10,
                output = (toInt(number % 100 / 10) === 1) ? 'th' :
                (b === 1) ? 'st' :
                (b === 2) ? 'nd' :
                (b === 3) ? 'rd' : 'th';
            return number + output;
        }
    });

    // Side effect imports

    hooks.lang = deprecate('moment.lang is deprecated. Use moment.locale instead.', getSetGlobalLocale);
    hooks.langData = deprecate('moment.langData is deprecated. Use moment.localeData instead.', getLocale);

    var mathAbs = Math.abs;

    function abs () {
        var data           = this._data;

        this._milliseconds = mathAbs(this._milliseconds);
        this._days         = mathAbs(this._days);
        this._months       = mathAbs(this._months);

        data.milliseconds  = mathAbs(data.milliseconds);
        data.seconds       = mathAbs(data.seconds);
        data.minutes       = mathAbs(data.minutes);
        data.hours         = mathAbs(data.hours);
        data.months        = mathAbs(data.months);
        data.years         = mathAbs(data.years);

        return this;
    }

    function addSubtract$1 (duration, input, value, direction) {
        var other = createDuration(input, value);

        duration._milliseconds += direction * other._milliseconds;
        duration._days         += direction * other._days;
        duration._months       += direction * other._months;

        return duration._bubble();
    }

    // supports only 2.0-style add(1, 's') or add(duration)
    function add$1 (input, value) {
        return addSubtract$1(this, input, value, 1);
    }

    // supports only 2.0-style subtract(1, 's') or subtract(duration)
    function subtract$1 (input, value) {
        return addSubtract$1(this, input, value, -1);
    }

    function absCeil (number) {
        if (number < 0) {
            return Math.floor(number);
        } else {
            return Math.ceil(number);
        }
    }

    function bubble () {
        var milliseconds = this._milliseconds;
        var days         = this._days;
        var months       = this._months;
        var data         = this._data;
        var seconds, minutes, hours, years, monthsFromDays;

        // if we have a mix of positive and negative values, bubble down first
        // check: https://github.com/moment/moment/issues/2166
        if (!((milliseconds >= 0 && days >= 0 && months >= 0) ||
                (milliseconds <= 0 && days <= 0 && months <= 0))) {
            milliseconds += absCeil(monthsToDays(months) + days) * 864e5;
            days = 0;
            months = 0;
        }

        // The following code bubbles up values, see the tests for
        // examples of what that means.
        data.milliseconds = milliseconds % 1000;

        seconds           = absFloor(milliseconds / 1000);
        data.seconds      = seconds % 60;

        minutes           = absFloor(seconds / 60);
        data.minutes      = minutes % 60;

        hours             = absFloor(minutes / 60);
        data.hours        = hours % 24;

        days += absFloor(hours / 24);

        // convert days to months
        monthsFromDays = absFloor(daysToMonths(days));
        months += monthsFromDays;
        days -= absCeil(monthsToDays(monthsFromDays));

        // 12 months -> 1 year
        years = absFloor(months / 12);
        months %= 12;

        data.days   = days;
        data.months = months;
        data.years  = years;

        return this;
    }

    function daysToMonths (days) {
        // 400 years have 146097 days (taking into account leap year rules)
        // 400 years have 12 months === 4800
        return days * 4800 / 146097;
    }

    function monthsToDays (months) {
        // the reverse of daysToMonths
        return months * 146097 / 4800;
    }

    function as (units) {
        if (!this.isValid()) {
            return NaN;
        }
        var days;
        var months;
        var milliseconds = this._milliseconds;

        units = normalizeUnits(units);

        if (units === 'month' || units === 'quarter' || units === 'year') {
            days = this._days + milliseconds / 864e5;
            months = this._months + daysToMonths(days);
            switch (units) {
                case 'month':   return months;
                case 'quarter': return months / 3;
                case 'year':    return months / 12;
            }
        } else {
            // handle milliseconds separately because of floating point math errors (issue #1867)
            days = this._days + Math.round(monthsToDays(this._months));
            switch (units) {
                case 'week'   : return days / 7     + milliseconds / 6048e5;
                case 'day'    : return days         + milliseconds / 864e5;
                case 'hour'   : return days * 24    + milliseconds / 36e5;
                case 'minute' : return days * 1440  + milliseconds / 6e4;
                case 'second' : return days * 86400 + milliseconds / 1000;
                // Math.floor prevents floating point math errors here
                case 'millisecond': return Math.floor(days * 864e5) + milliseconds;
                default: throw new Error('Unknown unit ' + units);
            }
        }
    }

    // TODO: Use this.as('ms')?
    function valueOf$1 () {
        if (!this.isValid()) {
            return NaN;
        }
        return (
            this._milliseconds +
            this._days * 864e5 +
            (this._months % 12) * 2592e6 +
            toInt(this._months / 12) * 31536e6
        );
    }

    function makeAs (alias) {
        return function () {
            return this.as(alias);
        };
    }

    var asMilliseconds = makeAs('ms');
    var asSeconds      = makeAs('s');
    var asMinutes      = makeAs('m');
    var asHours        = makeAs('h');
    var asDays         = makeAs('d');
    var asWeeks        = makeAs('w');
    var asMonths       = makeAs('M');
    var asQuarters     = makeAs('Q');
    var asYears        = makeAs('y');

    function clone$1 () {
        return createDuration(this);
    }

    function get$2 (units) {
        units = normalizeUnits(units);
        return this.isValid() ? this[units + 's']() : NaN;
    }

    function makeGetter(name) {
        return function () {
            return this.isValid() ? this._data[name] : NaN;
        };
    }

    var milliseconds = makeGetter('milliseconds');
    var seconds      = makeGetter('seconds');
    var minutes      = makeGetter('minutes');
    var hours        = makeGetter('hours');
    var days         = makeGetter('days');
    var months       = makeGetter('months');
    var years        = makeGetter('years');

    function weeks () {
        return absFloor(this.days() / 7);
    }

    var round = Math.round;
    var thresholds = {
        ss: 44,         // a few seconds to seconds
        s : 45,         // seconds to minute
        m : 45,         // minutes to hour
        h : 22,         // hours to day
        d : 26,         // days to month
        M : 11          // months to year
    };

    // helper function for moment.fn.from, moment.fn.fromNow, and moment.duration.fn.humanize
    function substituteTimeAgo(string, number, withoutSuffix, isFuture, locale) {
        return locale.relativeTime(number || 1, !!withoutSuffix, string, isFuture);
    }

    function relativeTime$1 (posNegDuration, withoutSuffix, locale) {
        var duration = createDuration(posNegDuration).abs();
        var seconds  = round(duration.as('s'));
        var minutes  = round(duration.as('m'));
        var hours    = round(duration.as('h'));
        var days     = round(duration.as('d'));
        var months   = round(duration.as('M'));
        var years    = round(duration.as('y'));

        var a = seconds <= thresholds.ss && ['s', seconds]  ||
                seconds < thresholds.s   && ['ss', seconds] ||
                minutes <= 1             && ['m']           ||
                minutes < thresholds.m   && ['mm', minutes] ||
                hours   <= 1             && ['h']           ||
                hours   < thresholds.h   && ['hh', hours]   ||
                days    <= 1             && ['d']           ||
                days    < thresholds.d   && ['dd', days]    ||
                months  <= 1             && ['M']           ||
                months  < thresholds.M   && ['MM', months]  ||
                years   <= 1             && ['y']           || ['yy', years];

        a[2] = withoutSuffix;
        a[3] = +posNegDuration > 0;
        a[4] = locale;
        return substituteTimeAgo.apply(null, a);
    }

    // This function allows you to set the rounding function for relative time strings
    function getSetRelativeTimeRounding (roundingFunction) {
        if (roundingFunction === undefined) {
            return round;
        }
        if (typeof(roundingFunction) === 'function') {
            round = roundingFunction;
            return true;
        }
        return false;
    }

    // This function allows you to set a threshold for relative time strings
    function getSetRelativeTimeThreshold (threshold, limit) {
        if (thresholds[threshold] === undefined) {
            return false;
        }
        if (limit === undefined) {
            return thresholds[threshold];
        }
        thresholds[threshold] = limit;
        if (threshold === 's') {
            thresholds.ss = limit - 1;
        }
        return true;
    }

    function humanize (withSuffix) {
        if (!this.isValid()) {
            return this.localeData().invalidDate();
        }

        var locale = this.localeData();
        var output = relativeTime$1(this, !withSuffix, locale);

        if (withSuffix) {
            output = locale.pastFuture(+this, output);
        }

        return locale.postformat(output);
    }

    var abs$1 = Math.abs;

    function sign(x) {
        return ((x > 0) - (x < 0)) || +x;
    }

    function toISOString$1() {
        // for ISO strings we do not use the normal bubbling rules:
        //  * milliseconds bubble up until they become hours
        //  * days do not bubble at all
        //  * months bubble up until they become years
        // This is because there is no context-free conversion between hours and days
        // (think of clock changes)
        // and also not between days and months (28-31 days per month)
        if (!this.isValid()) {
            return this.localeData().invalidDate();
        }

        var seconds = abs$1(this._milliseconds) / 1000;
        var days         = abs$1(this._days);
        var months       = abs$1(this._months);
        var minutes, hours, years;

        // 3600 seconds -> 60 minutes -> 1 hour
        minutes           = absFloor(seconds / 60);
        hours             = absFloor(minutes / 60);
        seconds %= 60;
        minutes %= 60;

        // 12 months -> 1 year
        years  = absFloor(months / 12);
        months %= 12;


        // inspired by https://github.com/dordille/moment-isoduration/blob/master/moment.isoduration.js
        var Y = years;
        var M = months;
        var D = days;
        var h = hours;
        var m = minutes;
        var s = seconds ? seconds.toFixed(3).replace(/\.?0+$/, '') : '';
        var total = this.asSeconds();

        if (!total) {
            // this is the same as C#'s (Noda) and python (isodate)...
            // but not other JS (goog.date)
            return 'P0D';
        }

        var totalSign = total < 0 ? '-' : '';
        var ymSign = sign(this._months) !== sign(total) ? '-' : '';
        var daysSign = sign(this._days) !== sign(total) ? '-' : '';
        var hmsSign = sign(this._milliseconds) !== sign(total) ? '-' : '';

        return totalSign + 'P' +
            (Y ? ymSign + Y + 'Y' : '') +
            (M ? ymSign + M + 'M' : '') +
            (D ? daysSign + D + 'D' : '') +
            ((h || m || s) ? 'T' : '') +
            (h ? hmsSign + h + 'H' : '') +
            (m ? hmsSign + m + 'M' : '') +
            (s ? hmsSign + s + 'S' : '');
    }

    var proto$2 = Duration.prototype;

    proto$2.isValid        = isValid$1;
    proto$2.abs            = abs;
    proto$2.add            = add$1;
    proto$2.subtract       = subtract$1;
    proto$2.as             = as;
    proto$2.asMilliseconds = asMilliseconds;
    proto$2.asSeconds      = asSeconds;
    proto$2.asMinutes      = asMinutes;
    proto$2.asHours        = asHours;
    proto$2.asDays         = asDays;
    proto$2.asWeeks        = asWeeks;
    proto$2.asMonths       = asMonths;
    proto$2.asQuarters     = asQuarters;
    proto$2.asYears        = asYears;
    proto$2.valueOf        = valueOf$1;
    proto$2._bubble        = bubble;
    proto$2.clone          = clone$1;
    proto$2.get            = get$2;
    proto$2.milliseconds   = milliseconds;
    proto$2.seconds        = seconds;
    proto$2.minutes        = minutes;
    proto$2.hours          = hours;
    proto$2.days           = days;
    proto$2.weeks          = weeks;
    proto$2.months         = months;
    proto$2.years          = years;
    proto$2.humanize       = humanize;
    proto$2.toISOString    = toISOString$1;
    proto$2.toString       = toISOString$1;
    proto$2.toJSON         = toISOString$1;
    proto$2.locale         = locale;
    proto$2.localeData     = localeData;

    proto$2.toIsoString = deprecate('toIsoString() is deprecated. Please use toISOString() instead (notice the capitals)', toISOString$1);
    proto$2.lang = lang;

    // Side effect imports

    // FORMATTING

    addFormatToken('X', 0, 0, 'unix');
    addFormatToken('x', 0, 0, 'valueOf');

    // PARSING

    addRegexToken('x', matchSigned);
    addRegexToken('X', matchTimestamp);
    addParseToken('X', function (input, array, config) {
        config._d = new Date(parseFloat(input, 10) * 1000);
    });
    addParseToken('x', function (input, array, config) {
        config._d = new Date(toInt(input));
    });

    // Side effect imports


    hooks.version = '2.24.0';

    setHookCallback(createLocal);

    hooks.fn                    = proto;
    hooks.min                   = min;
    hooks.max                   = max;
    hooks.now                   = now;
    hooks.utc                   = createUTC;
    hooks.unix                  = createUnix;
    hooks.months                = listMonths;
    hooks.isDate                = isDate;
    hooks.locale                = getSetGlobalLocale;
    hooks.invalid               = createInvalid;
    hooks.duration              = createDuration;
    hooks.isMoment              = isMoment;
    hooks.weekdays              = listWeekdays;
    hooks.parseZone             = createInZone;
    hooks.localeData            = getLocale;
    hooks.isDuration            = isDuration;
    hooks.monthsShort           = listMonthsShort;
    hooks.weekdaysMin           = listWeekdaysMin;
    hooks.defineLocale          = defineLocale;
    hooks.updateLocale          = updateLocale;
    hooks.locales               = listLocales;
    hooks.weekdaysShort         = listWeekdaysShort;
    hooks.normalizeUnits        = normalizeUnits;
    hooks.relativeTimeRounding  = getSetRelativeTimeRounding;
    hooks.relativeTimeThreshold = getSetRelativeTimeThreshold;
    hooks.calendarFormat        = getCalendarFormat;
    hooks.prototype             = proto;

    // currently HTML5 input type only supports 24-hour formats
    hooks.HTML5_FMT = {
        DATETIME_LOCAL: 'YYYY-MM-DDTHH:mm',             // <input type="datetime-local" />
        DATETIME_LOCAL_SECONDS: 'YYYY-MM-DDTHH:mm:ss',  // <input type="datetime-local" step="1" />
        DATETIME_LOCAL_MS: 'YYYY-MM-DDTHH:mm:ss.SSS',   // <input type="datetime-local" step="0.001" />
        DATE: 'YYYY-MM-DD',                             // <input type="date" />
        TIME: 'HH:mm',                                  // <input type="time" />
        TIME_SECONDS: 'HH:mm:ss',                       // <input type="time" step="1" />
        TIME_MS: 'HH:mm:ss.SSS',                        // <input type="time" step="0.001" />
        WEEK: 'GGGG-[W]WW',                             // <input type="week" />
        MONTH: 'YYYY-MM'                                // <input type="month" />
    };

    return hooks;

})));
//! moment-timezone.js
//! version : 0.5.25
//! Copyright (c) JS Foundation and other contributors
//! license : MIT
//! github.com/moment/moment-timezone

(function (root, factory) {
	"use strict";

	/*global define*/
	if (typeof module === 'object' && module.exports) {
		module.exports = factory(require('moment')); // Node
	} else if (typeof define === 'function' && define.amd) {
		define(['moment'], factory);                 // AMD
	} else {
		factory(root.moment);                        // Browser
	}
}(this, function (moment) {
	"use strict";

	// Do not load moment-timezone a second time.
	// if (moment.tz !== undefined) {
	// 	logError('Moment Timezone ' + moment.tz.version + ' was already loaded ' + (moment.tz.dataVersion ? 'with data from ' : 'without any data') + moment.tz.dataVersion);
	// 	return moment;
	// }

	var VERSION = "0.5.25",
		zones = {},
		links = {},
		names = {},
		guesses = {},
		cachedGuess;

	if (!moment || typeof moment.version !== 'string') {
		logError('Moment Timezone requires Moment.js. See https://momentjs.com/timezone/docs/#/use-it/browser/');
	}

	var momentVersion = moment.version.split('.'),
		major = +momentVersion[0],
		minor = +momentVersion[1];

	// Moment.js version check
	if (major < 2 || (major === 2 && minor < 6)) {
		logError('Moment Timezone requires Moment.js >= 2.6.0. You are using Moment.js ' + moment.version + '. See momentjs.com');
	}

	/************************************
		Unpacking
	************************************/

	function charCodeToInt(charCode) {
		if (charCode > 96) {
			return charCode - 87;
		} else if (charCode > 64) {
			return charCode - 29;
		}
		return charCode - 48;
	}

	function unpackBase60(string) {
		var i = 0,
			parts = string.split('.'),
			whole = parts[0],
			fractional = parts[1] || '',
			multiplier = 1,
			num,
			out = 0,
			sign = 1;

		// handle negative numbers
		if (string.charCodeAt(0) === 45) {
			i = 1;
			sign = -1;
		}

		// handle digits before the decimal
		for (i; i < whole.length; i++) {
			num = charCodeToInt(whole.charCodeAt(i));
			out = 60 * out + num;
		}

		// handle digits after the decimal
		for (i = 0; i < fractional.length; i++) {
			multiplier = multiplier / 60;
			num = charCodeToInt(fractional.charCodeAt(i));
			out += num * multiplier;
		}

		return out * sign;
	}

	function arrayToInt (array) {
		for (var i = 0; i < array.length; i++) {
			array[i] = unpackBase60(array[i]);
		}
	}

	function intToUntil (array, length) {
		for (var i = 0; i < length; i++) {
			array[i] = Math.round((array[i - 1] || 0) + (array[i] * 60000)); // minutes to milliseconds
		}

		array[length - 1] = Infinity;
	}

	function mapIndices (source, indices) {
		var out = [], i;

		for (i = 0; i < indices.length; i++) {
			out[i] = source[indices[i]];
		}

		return out;
	}

	function unpack (string) {
		var data = string.split('|'),
			offsets = data[2].split(' '),
			indices = data[3].split(''),
			untils  = data[4].split(' ');

		arrayToInt(offsets);
		arrayToInt(indices);
		arrayToInt(untils);

		intToUntil(untils, indices.length);

		return {
			name       : data[0],
			abbrs      : mapIndices(data[1].split(' '), indices),
			offsets    : mapIndices(offsets, indices),
			untils     : untils,
			population : data[5] | 0
		};
	}

	/************************************
		Zone object
	************************************/

	function Zone (packedString) {
		if (packedString) {
			this._set(unpack(packedString));
		}
	}

	Zone.prototype = {
		_set : function (unpacked) {
			this.name       = unpacked.name;
			this.abbrs      = unpacked.abbrs;
			this.untils     = unpacked.untils;
			this.offsets    = unpacked.offsets;
			this.population = unpacked.population;
		},

		_index : function (timestamp) {
			var target = +timestamp,
				untils = this.untils,
				i;

			for (i = 0; i < untils.length; i++) {
				if (target < untils[i]) {
					return i;
				}
			}
		},

		parse : function (timestamp) {
			var target  = +timestamp,
				offsets = this.offsets,
				untils  = this.untils,
				max     = untils.length - 1,
				offset, offsetNext, offsetPrev, i;

			for (i = 0; i < max; i++) {
				offset     = offsets[i];
				offsetNext = offsets[i + 1];
				offsetPrev = offsets[i ? i - 1 : i];

				if (offset < offsetNext && tz.moveAmbiguousForward) {
					offset = offsetNext;
				} else if (offset > offsetPrev && tz.moveInvalidForward) {
					offset = offsetPrev;
				}

				if (target < untils[i] - (offset * 60000)) {
					return offsets[i];
				}
			}

			return offsets[max];
		},

		abbr : function (mom) {
			return this.abbrs[this._index(mom)];
		},

		offset : function (mom) {
			logError("zone.offset has been deprecated in favor of zone.utcOffset");
			return this.offsets[this._index(mom)];
		},

		utcOffset : function (mom) {
			return this.offsets[this._index(mom)];
		}
	};

	/************************************
		Current Timezone
	************************************/

	function OffsetAt(at) {
		var timeString = at.toTimeString();
		var abbr = timeString.match(/\([a-z ]+\)/i);
		if (abbr && abbr[0]) {
			// 17:56:31 GMT-0600 (CST)
			// 17:56:31 GMT-0600 (Central Standard Time)
			abbr = abbr[0].match(/[A-Z]/g);
			abbr = abbr ? abbr.join('') : undefined;
		} else {
			// 17:56:31 CST
			// 17:56:31 GMT+0800 (台北標準時間)
			abbr = timeString.match(/[A-Z]{3,5}/g);
			abbr = abbr ? abbr[0] : undefined;
		}

		if (abbr === 'GMT') {
			abbr = undefined;
		}

		this.at = +at;
		this.abbr = abbr;
		this.offset = at.getTimezoneOffset();
	}

	function ZoneScore(zone) {
		this.zone = zone;
		this.offsetScore = 0;
		this.abbrScore = 0;
	}

	ZoneScore.prototype.scoreOffsetAt = function (offsetAt) {
		this.offsetScore += Math.abs(this.zone.utcOffset(offsetAt.at) - offsetAt.offset);
		if (this.zone.abbr(offsetAt.at).replace(/[^A-Z]/g, '') !== offsetAt.abbr) {
			this.abbrScore++;
		}
	};

	function findChange(low, high) {
		var mid, diff;

		while ((diff = ((high.at - low.at) / 12e4 | 0) * 6e4)) {
			mid = new OffsetAt(new Date(low.at + diff));
			if (mid.offset === low.offset) {
				low = mid;
			} else {
				high = mid;
			}
		}

		return low;
	}

	function userOffsets() {
		var startYear = new Date().getFullYear() - 2,
			last = new OffsetAt(new Date(startYear, 0, 1)),
			offsets = [last],
			change, next, i;

		for (i = 1; i < 48; i++) {
			next = new OffsetAt(new Date(startYear, i, 1));
			if (next.offset !== last.offset) {
				change = findChange(last, next);
				offsets.push(change);
				offsets.push(new OffsetAt(new Date(change.at + 6e4)));
			}
			last = next;
		}

		for (i = 0; i < 4; i++) {
			offsets.push(new OffsetAt(new Date(startYear + i, 0, 1)));
			offsets.push(new OffsetAt(new Date(startYear + i, 6, 1)));
		}

		return offsets;
	}

	function sortZoneScores (a, b) {
		if (a.offsetScore !== b.offsetScore) {
			return a.offsetScore - b.offsetScore;
		}
		if (a.abbrScore !== b.abbrScore) {
			return a.abbrScore - b.abbrScore;
		}
		return b.zone.population - a.zone.population;
	}

	function addToGuesses (name, offsets) {
		var i, offset;
		arrayToInt(offsets);
		for (i = 0; i < offsets.length; i++) {
			offset = offsets[i];
			guesses[offset] = guesses[offset] || {};
			guesses[offset][name] = true;
		}
	}

	function guessesForUserOffsets (offsets) {
		var offsetsLength = offsets.length,
			filteredGuesses = {},
			out = [],
			i, j, guessesOffset;

		for (i = 0; i < offsetsLength; i++) {
			guessesOffset = guesses[offsets[i].offset] || {};
			for (j in guessesOffset) {
				if (guessesOffset.hasOwnProperty(j)) {
					filteredGuesses[j] = true;
				}
			}
		}

		for (i in filteredGuesses) {
			if (filteredGuesses.hasOwnProperty(i)) {
				out.push(names[i]);
			}
		}

		return out;
	}

	function rebuildGuess () {

		// use Intl API when available and returning valid time zone
		try {
			var intlName = Intl.DateTimeFormat().resolvedOptions().timeZone;
			if (intlName && intlName.length > 3) {
				var name = names[normalizeName(intlName)];
				if (name) {
					return name;
				}
				logError("Moment Timezone found " + intlName + " from the Intl api, but did not have that data loaded.");
			}
		} catch (e) {
			// Intl unavailable, fall back to manual guessing.
		}

		var offsets = userOffsets(),
			offsetsLength = offsets.length,
			guesses = guessesForUserOffsets(offsets),
			zoneScores = [],
			zoneScore, i, j;

		for (i = 0; i < guesses.length; i++) {
			zoneScore = new ZoneScore(getZone(guesses[i]), offsetsLength);
			for (j = 0; j < offsetsLength; j++) {
				zoneScore.scoreOffsetAt(offsets[j]);
			}
			zoneScores.push(zoneScore);
		}

		zoneScores.sort(sortZoneScores);

		return zoneScores.length > 0 ? zoneScores[0].zone.name : undefined;
	}

	function guess (ignoreCache) {
		if (!cachedGuess || ignoreCache) {
			cachedGuess = rebuildGuess();
		}
		return cachedGuess;
	}

	/************************************
		Global Methods
	************************************/

	function normalizeName (name) {
		return (name || '').toLowerCase().replace(/\//g, '_');
	}

	function addZone (packed) {
		var i, name, split, normalized;

		if (typeof packed === "string") {
			packed = [packed];
		}

		for (i = 0; i < packed.length; i++) {
			split = packed[i].split('|');
			name = split[0];
			normalized = normalizeName(name);
			zones[normalized] = packed[i];
			names[normalized] = name;
			addToGuesses(normalized, split[2].split(' '));
		}
	}

	function getZone (name, caller) {
		
		name = normalizeName(name);

		var zone = zones[name];
		var link;

		if (zone instanceof Zone) {
			return zone;
		}

		if (typeof zone === 'string') {
			zone = new Zone(zone);
			zones[name] = zone;
			return zone;
		}

		// Pass getZone to prevent recursion more than 1 level deep
		if (links[name] && caller !== getZone && (link = getZone(links[name], getZone))) {
			zone = zones[name] = new Zone();
			zone._set(link);
			zone.name = names[name];
			return zone;
		}

		return null;
	}

	function getNames () {
		var i, out = [];

		for (i in names) {
			if (names.hasOwnProperty(i) && (zones[i] || zones[links[i]]) && names[i]) {
				out.push(names[i]);
			}
		}

		return out.sort();
	}

	function addLink (aliases) {
		var i, alias, normal0, normal1;

		if (typeof aliases === "string") {
			aliases = [aliases];
		}

		for (i = 0; i < aliases.length; i++) {
			alias = aliases[i].split('|');

			normal0 = normalizeName(alias[0]);
			normal1 = normalizeName(alias[1]);

			links[normal0] = normal1;
			names[normal0] = alias[0];

			links[normal1] = normal0;
			names[normal1] = alias[1];
		}
	}

	function loadData (data) {
		addZone(data.zones);
		addLink(data.links);
		tz.dataVersion = data.version;
	}

	function zoneExists (name) {
		if (!zoneExists.didShowError) {
			zoneExists.didShowError = true;
				logError("moment.tz.zoneExists('" + name + "') has been deprecated in favor of !moment.tz.zone('" + name + "')");
		}
		return !!getZone(name);
	}

	function needsOffset (m) {
		var isUnixTimestamp = (m._f === 'X' || m._f === 'x');
		return !!(m._a && (m._tzm === undefined) && !isUnixTimestamp);
	}

	function logError (message) {
		if (typeof console !== 'undefined' && typeof console.error === 'function') {
			console.error(message);
		}
	}

	/************************************
		moment.tz namespace
	************************************/

	function tz (input) {
		var args = Array.prototype.slice.call(arguments, 0, -1),
			name = arguments[arguments.length - 1],
			zone = getZone(name),
			out  = moment.utc.apply(null, args);

		if (zone && !moment.isMoment(input) && needsOffset(out)) {
			out.add(zone.parse(out), 'minutes');
		}

		out.tz(name);

		return out;
	}

	tz.version      = VERSION;
	tz.dataVersion  = '';
	tz._zones       = zones;
	tz._links       = links;
	tz._names       = names;
	tz.add          = addZone;
	tz.link         = addLink;
	tz.load         = loadData;
	tz.zone         = getZone;
	tz.zoneExists   = zoneExists; // deprecated in 0.1.0
	tz.guess        = guess;
	tz.names        = getNames;
	tz.Zone         = Zone;
	tz.unpack       = unpack;
	tz.unpackBase60 = unpackBase60;
	tz.needsOffset  = needsOffset;
	tz.moveInvalidForward   = true;
	tz.moveAmbiguousForward = false;

	/************************************
		Interface with Moment.js
	************************************/

	var fn = moment.fn;

	moment.tz = tz;

	moment.defaultZone = null;

	moment.updateOffset = function (mom, keepTime) {
		var zone = moment.defaultZone,
			offset;

		if (mom._z === undefined) {
			if (zone && needsOffset(mom) && !mom._isUTC) {
				mom._d = moment.utc(mom._a)._d;
				mom.utc().add(zone.parse(mom), 'minutes');
			}
			mom._z = zone;
		}
		if (mom._z) {
			offset = mom._z.utcOffset(mom);
			if (Math.abs(offset) < 16) {
				offset = offset / 60;
			}
			if (mom.utcOffset !== undefined) {
				var z = mom._z;
				mom.utcOffset(-offset, keepTime);
				mom._z = z;
			} else {
				mom.zone(offset, keepTime);
			}
		}
	};

	fn.tz = function (name, keepTime) {
		if (name) {
			if (typeof name !== 'string') {
				throw new Error('Time zone name must be a string, got ' + name + ' [' + typeof name + ']');
			}
			this._z = getZone(name);
			if (this._z) {
				moment.updateOffset(this, keepTime);
			} else {
				logError("Moment Timezone has no data for " + name + ". See http://momentjs.com/timezone/docs/#/data-loading/.");
			}
			return this;
		}
		if (this._z) { return this._z.name; }
	};

	function abbrWrap (old) {
		return function () {
			if (this._z) { return this._z.abbr(this); }
			return old.call(this);
		};
	}

	function resetZoneWrap (old) {
		return function () {
			this._z = null;
			return old.apply(this, arguments);
		};
	}

	function resetZoneWrap2 (old) {
		return function () {
			if (arguments.length > 0) this._z = null;
			return old.apply(this, arguments);
		};
	}

	fn.zoneName  = abbrWrap(fn.zoneName);
	fn.zoneAbbr  = abbrWrap(fn.zoneAbbr);
	fn.utc       = resetZoneWrap(fn.utc);
	fn.local     = resetZoneWrap(fn.local);
	fn.utcOffset = resetZoneWrap2(fn.utcOffset);
	
	moment.tz.setDefault = function(name) {
		if (major < 2 || (major === 2 && minor < 9)) {
			logError('Moment Timezone setDefault() requires Moment.js >= 2.9.0. You are using Moment.js ' + moment.version + '.');
		}
		moment.defaultZone = name ? getZone(name) : null;
		return moment;
	};

	// Cloning a moment should include the _z property.
	var momentProperties = moment.momentProperties;
	if (Object.prototype.toString.call(momentProperties) === '[object Array]') {
		// moment 2.8.1+
		momentProperties.push('_z');
		momentProperties.push('_a');
	} else if (momentProperties) {
		// moment 2.7.0
		momentProperties._z = null;
	}

	loadData({
		"version": "2019a",
		"zones": [
			"Africa/Abidjan|GMT|0|0||48e5",
			"Africa/Nairobi|EAT|-30|0||47e5",
			"Africa/Algiers|CET|-10|0||26e5",
			"Africa/Lagos|WAT|-10|0||17e6",
			"Africa/Maputo|CAT|-20|0||26e5",
			"Africa/Cairo|EET EEST|-20 -30|01010|1M2m0 gL0 e10 mn0|15e6",
			"Africa/Casablanca|+00 +01|0 -10|01010101010101010101010101010101|1LHC0 A00 e00 y00 11A0 uM0 e00 Dc0 11A0 s00 e00 IM0 WM0 mo0 gM0 LA0 WM0 jA0 e00 28M0 e00 2600 e00 28M0 e00 2600 gM0 2600 e00 28M0 e00|32e5",
			"Europe/Paris|CET CEST|-10 -20|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|11e6",
			"Africa/Johannesburg|SAST|-20|0||84e5",
			"Africa/Khartoum|EAT CAT|-30 -20|01|1Usl0|51e5",
			"Africa/Sao_Tome|GMT WAT|0 -10|010|1UQN0 2q00",
			"Africa/Tripoli|EET|-20|0||11e5",
			"Africa/Windhoek|CAT WAT|-20 -10|010101010|1LKo0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0|32e4",
			"America/Adak|HST HDT|a0 90|01010101010101010101010|1Lzo0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|326",
			"America/Anchorage|AKST AKDT|90 80|01010101010101010101010|1Lzn0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|30e4",
			"America/Santo_Domingo|AST|40|0||29e5",
			"America/Fortaleza|-03|30|0||34e5",
			"America/Asuncion|-03 -04|30 40|01010101010101010101010|1LEP0 1ip0 17b0 1ip0 19X0 1fB0 19X0 1fB0 19X0 1ip0 17b0 1ip0 17b0 1ip0 19X0 1fB0 19X0 1fB0 19X0 1fB0 19X0 1ip0|28e5",
			"America/Panama|EST|50|0||15e5",
			"America/Mexico_City|CST CDT|60 50|01010101010101010101010|1LKw0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0|20e6",
			"America/Managua|CST|60|0||22e5",
			"America/La_Paz|-04|40|0||19e5",
			"America/Lima|-05|50|0||11e6",
			"America/Denver|MST MDT|70 60|01010101010101010101010|1Lzl0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|26e5",
			"America/Campo_Grande|-03 -04|30 40|01010101010101010101010|1LqP0 1C10 On0 1zd0 On0 1zd0 On0 1zd0 On0 1HB0 FX0 1HB0 FX0 1HB0 IL0 1HB0 FX0 1HB0 IL0 1EN0 FX0 1HB0|77e4",
			"America/Cancun|CST CDT EST|60 50 50|0102|1LKw0 1lb0 Dd0|63e4",
			"America/Caracas|-0430 -04|4u 40|01|1QMT0|29e5",
			"America/Chicago|CST CDT|60 50|01010101010101010101010|1Lzk0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|92e5",
			"America/Chihuahua|MST MDT|70 60|01010101010101010101010|1LKx0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0|81e4",
			"America/Phoenix|MST|70|0||42e5",
			"America/Los_Angeles|PST PDT|80 70|01010101010101010101010|1Lzm0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|15e6",
			"America/New_York|EST EDT|50 40|01010101010101010101010|1Lzj0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|21e6",
			"America/Fort_Nelson|PST PDT MST|80 70 70|0102|1Lzm0 1zb0 Op0|39e2",
			"America/Halifax|AST ADT|40 30|01010101010101010101010|1Lzi0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|39e4",
			"America/Godthab|-03 -02|30 20|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|17e3",
			"America/Grand_Turk|EST EDT AST|50 40 40|0101210101010101010|1Lzj0 1zb0 Op0 1zb0 5Ip0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|37e2",
			"America/Havana|CST CDT|50 40|01010101010101010101010|1Lzh0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0|21e5",
			"America/Metlakatla|PST AKST AKDT|80 90 80|012121201212121212121|1PAa0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 uM0 jB0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|14e2",
			"America/Miquelon|-03 -02|30 20|01010101010101010101010|1Lzh0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|61e2",
			"America/Montevideo|-02 -03|20 30|0101|1Lzg0 1o10 11z0|17e5",
			"America/Noronha|-02|20|0||30e2",
			"America/Port-au-Prince|EST EDT|50 40|010101010101010101010|1Lzj0 1zb0 Op0 1zb0 3iN0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|23e5",
			"Antarctica/Palmer|-03 -04|30 40|01010|1LSP0 Rd0 46n0 Ap0|40",
			"America/Santiago|-03 -04|30 40|010101010101010101010|1LSP0 Rd0 46n0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1zb0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 11B0|62e5",
			"America/Sao_Paulo|-02 -03|20 30|01010101010101010101010|1LqO0 1C10 On0 1zd0 On0 1zd0 On0 1zd0 On0 1HB0 FX0 1HB0 FX0 1HB0 IL0 1HB0 FX0 1HB0 IL0 1EN0 FX0 1HB0|20e6",
			"Atlantic/Azores|-01 +00|10 0|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|25e4",
			"America/St_Johns|NST NDT|3u 2u|01010101010101010101010|1Lzhu 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|11e4",
			"Antarctica/Casey|+08 +11|-80 -b0|010|1RWg0 3m10|10",
			"Asia/Bangkok|+07|-70|0||15e6",
			"Pacific/Port_Moresby|+10|-a0|0||25e4",
			"Pacific/Guadalcanal|+11|-b0|0||11e4",
			"Asia/Tashkent|+05|-50|0||23e5",
			"Pacific/Auckland|NZDT NZST|-d0 -c0|01010101010101010101010|1LKe0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1io0 1a00|14e5",
			"Asia/Baghdad|+03|-30|0||66e5",
			"Antarctica/Troll|+00 +02|0 -20|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|40",
			"Asia/Dhaka|+06|-60|0||16e6",
			"Asia/Amman|EET EEST|-20 -30|01010101010101010101010|1LGK0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00|25e5",
			"Asia/Kamchatka|+12|-c0|0||18e4",
			"Asia/Baku|+04 +05|-40 -50|01010|1LHA0 1o00 11A0 1o00|27e5",
			"Asia/Barnaul|+07 +06|-70 -60|010|1N7v0 3rd0",
			"Asia/Beirut|EET EEST|-20 -30|01010101010101010101010|1LHy0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0|22e5",
			"Asia/Kuala_Lumpur|+08|-80|0||71e5",
			"Asia/Kolkata|IST|-5u|0||15e6",
			"Asia/Chita|+10 +08 +09|-a0 -80 -90|012|1N7s0 3re0|33e4",
			"Asia/Ulaanbaatar|+08 +09|-80 -90|01010|1O8G0 1cJ0 1cP0 1cJ0|12e5",
			"Asia/Shanghai|CST|-80|0||23e6",
			"Asia/Colombo|+0530|-5u|0||22e5",
			"Asia/Damascus|EET EEST|-20 -30|01010101010101010101010|1LGK0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0|26e5",
			"Asia/Dili|+09|-90|0||19e4",
			"Asia/Dubai|+04|-40|0||39e5",
			"Asia/Famagusta|EET EEST +03|-20 -30 -30|0101012010101010101010|1LHB0 1o00 11A0 1o00 11A0 15U0 2Ks0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00",
			"Asia/Gaza|EET EEST|-20 -30|01010101010101010101010|1LGK0 1nX0 1210 1nz0 1220 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0|18e5",
			"Asia/Hong_Kong|HKT|-80|0||73e5",
			"Asia/Hovd|+07 +08|-70 -80|01010|1O8H0 1cJ0 1cP0 1cJ0|81e3",
			"Asia/Irkutsk|+09 +08|-90 -80|01|1N7t0|60e4",
			"Europe/Istanbul|EET EEST +03|-20 -30 -30|0101012|1LI10 1nA0 11A0 1tA0 U00 15w0|13e6",
			"Asia/Jakarta|WIB|-70|0||31e6",
			"Asia/Jayapura|WIT|-90|0||26e4",
			"Asia/Jerusalem|IST IDT|-20 -30|01010101010101010101010|1LGM0 1oL0 10N0 1oL0 10N0 1rz0 W10 1rz0 W10 1rz0 10N0 1oL0 10N0 1oL0 10N0 1rz0 W10 1rz0 W10 1rz0 10N0 1oL0|81e4",
			"Asia/Kabul|+0430|-4u|0||46e5",
			"Asia/Karachi|PKT|-50|0||24e6",
			"Asia/Kathmandu|+0545|-5J|0||12e5",
			"Asia/Yakutsk|+10 +09|-a0 -90|01|1N7s0|28e4",
			"Asia/Krasnoyarsk|+08 +07|-80 -70|01|1N7u0|10e5",
			"Asia/Magadan|+12 +10 +11|-c0 -a0 -b0|012|1N7q0 3Cq0|95e3",
			"Asia/Makassar|WITA|-80|0||15e5",
			"Asia/Manila|PST|-80|0||24e6",
			"Europe/Athens|EET EEST|-20 -30|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|35e5",
			"Asia/Novosibirsk|+07 +06|-70 -60|010|1N7v0 4eN0|15e5",
			"Asia/Omsk|+07 +06|-70 -60|01|1N7v0|12e5",
			"Asia/Pyongyang|KST KST|-90 -8u|010|1P4D0 6BA0|29e5",
			"Asia/Qyzylorda|+06 +05|-60 -50|01|1Xei0|73e4",
			"Asia/Rangoon|+0630|-6u|0||48e5",
			"Asia/Sakhalin|+11 +10|-b0 -a0|010|1N7r0 3rd0|58e4",
			"Asia/Seoul|KST|-90|0||23e6",
			"Asia/Srednekolymsk|+12 +11|-c0 -b0|01|1N7q0|35e2",
			"Asia/Tehran|+0330 +0430|-3u -4u|01010101010101010101010|1LEku 1dz0 1cp0 1dz0 1cp0 1dz0 1cN0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0 1cN0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0|14e6",
			"Asia/Tokyo|JST|-90|0||38e6",
			"Asia/Tomsk|+07 +06|-70 -60|010|1N7v0 3Qp0|10e5",
			"Asia/Vladivostok|+11 +10|-b0 -a0|01|1N7r0|60e4",
			"Asia/Yekaterinburg|+06 +05|-60 -50|01|1N7w0|14e5",
			"Europe/Lisbon|WET WEST|0 -10|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|27e5",
			"Atlantic/Cape_Verde|-01|10|0||50e4",
			"Australia/Sydney|AEDT AEST|-b0 -a0|01010101010101010101010|1LKg0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0|40e5",
			"Australia/Adelaide|ACDT ACST|-au -9u|01010101010101010101010|1LKgu 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0|11e5",
			"Australia/Brisbane|AEST|-a0|0||20e5",
			"Australia/Darwin|ACST|-9u|0||12e4",
			"Australia/Eucla|+0845|-8J|0||368",
			"Australia/Lord_Howe|+11 +1030|-b0 -au|01010101010101010101010|1LKf0 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1fAu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1fzu 1cMu|347",
			"Australia/Perth|AWST|-80|0||18e5",
			"Pacific/Easter|-05 -06|50 60|010101010101010101010|1LSP0 Rd0 46n0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1zb0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 11B0|30e2",
			"Europe/Dublin|GMT IST|0 -10|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|12e5",
			"Etc/GMT-1|+01|-10|0|",
			"Pacific/Fakaofo|+13|-d0|0||483",
			"Pacific/Kiritimati|+14|-e0|0||51e2",
			"Etc/GMT-2|+02|-20|0|",
			"Pacific/Tahiti|-10|a0|0||18e4",
			"Pacific/Niue|-11|b0|0||12e2",
			"Etc/GMT+12|-12|c0|0|",
			"Pacific/Galapagos|-06|60|0||25e3",
			"Etc/GMT+7|-07|70|0|",
			"Pacific/Pitcairn|-08|80|0||56",
			"Pacific/Gambier|-09|90|0||125",
			"Etc/UTC|UTC|0|0|",
			"Europe/Ulyanovsk|+04 +03|-40 -30|010|1N7y0 3rd0|13e5",
			"Europe/London|GMT BST|0 -10|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|10e6",
			"Europe/Chisinau|EET EEST|-20 -30|01010101010101010101010|1LHA0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|67e4",
			"Europe/Kaliningrad|+03 EET|-30 -20|01|1N7z0|44e4",
			"Europe/Kirov|+04 +03|-40 -30|01|1N7y0|48e4",
			"Europe/Moscow|MSK MSK|-40 -30|01|1N7y0|16e6",
			"Europe/Saratov|+04 +03|-40 -30|010|1N7y0 5810",
			"Europe/Simferopol|EET MSK MSK|-20 -40 -30|012|1LHA0 1nW0|33e4",
			"Europe/Volgograd|+04 +03|-40 -30|010|1N7y0 9Jd0|10e5",
			"Pacific/Honolulu|HST|a0|0||37e4",
			"MET|MET MEST|-10 -20|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00",
			"Pacific/Chatham|+1345 +1245|-dJ -cJ|01010101010101010101010|1LKe0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1io0 1a00|600",
			"Pacific/Apia|+14 +13|-e0 -d0|01010101010101010101010|1LKe0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1io0 1a00|37e3",
			"Pacific/Bougainville|+10 +11|-a0 -b0|01|1NwE0|18e4",
			"Pacific/Fiji|+13 +12|-d0 -c0|01010101010101010101010|1Lfp0 1SN0 uM0 1SM0 uM0 1VA0 s00 1VA0 s00 1VA0 s00 1VA0 uM0 1SM0 uM0 1VA0 s00 1VA0 s00 1VA0 s00 1VA0|88e4",
			"Pacific/Guam|ChST|-a0|0||17e4",
			"Pacific/Marquesas|-0930|9u|0||86e2",
			"Pacific/Pago_Pago|SST|b0|0||37e2",
			"Pacific/Norfolk|+1130 +11|-bu -b0|01|1PoCu|25e4",
			"Pacific/Tongatapu|+13 +14|-d0 -e0|010|1S4d0 s00|75e3"
		],
		"links": [
			"Africa/Abidjan|Africa/Accra",
			"Africa/Abidjan|Africa/Bamako",
			"Africa/Abidjan|Africa/Banjul",
			"Africa/Abidjan|Africa/Bissau",
			"Africa/Abidjan|Africa/Conakry",
			"Africa/Abidjan|Africa/Dakar",
			"Africa/Abidjan|Africa/Freetown",
			"Africa/Abidjan|Africa/Lome",
			"Africa/Abidjan|Africa/Monrovia",
			"Africa/Abidjan|Africa/Nouakchott",
			"Africa/Abidjan|Africa/Ouagadougou",
			"Africa/Abidjan|Africa/Timbuktu",
			"Africa/Abidjan|America/Danmarkshavn",
			"Africa/Abidjan|Atlantic/Reykjavik",
			"Africa/Abidjan|Atlantic/St_Helena",
			"Africa/Abidjan|Etc/GMT",
			"Africa/Abidjan|Etc/GMT+0",
			"Africa/Abidjan|Etc/GMT-0",
			"Africa/Abidjan|Etc/GMT0",
			"Africa/Abidjan|Etc/Greenwich",
			"Africa/Abidjan|GMT",
			"Africa/Abidjan|GMT+0",
			"Africa/Abidjan|GMT-0",
			"Africa/Abidjan|GMT0",
			"Africa/Abidjan|Greenwich",
			"Africa/Abidjan|Iceland",
			"Africa/Algiers|Africa/Tunis",
			"Africa/Cairo|Egypt",
			"Africa/Casablanca|Africa/El_Aaiun",
			"Africa/Johannesburg|Africa/Maseru",
			"Africa/Johannesburg|Africa/Mbabane",
			"Africa/Lagos|Africa/Bangui",
			"Africa/Lagos|Africa/Brazzaville",
			"Africa/Lagos|Africa/Douala",
			"Africa/Lagos|Africa/Kinshasa",
			"Africa/Lagos|Africa/Libreville",
			"Africa/Lagos|Africa/Luanda",
			"Africa/Lagos|Africa/Malabo",
			"Africa/Lagos|Africa/Ndjamena",
			"Africa/Lagos|Africa/Niamey",
			"Africa/Lagos|Africa/Porto-Novo",
			"Africa/Maputo|Africa/Blantyre",
			"Africa/Maputo|Africa/Bujumbura",
			"Africa/Maputo|Africa/Gaborone",
			"Africa/Maputo|Africa/Harare",
			"Africa/Maputo|Africa/Kigali",
			"Africa/Maputo|Africa/Lubumbashi",
			"Africa/Maputo|Africa/Lusaka",
			"Africa/Nairobi|Africa/Addis_Ababa",
			"Africa/Nairobi|Africa/Asmara",
			"Africa/Nairobi|Africa/Asmera",
			"Africa/Nairobi|Africa/Dar_es_Salaam",
			"Africa/Nairobi|Africa/Djibouti",
			"Africa/Nairobi|Africa/Juba",
			"Africa/Nairobi|Africa/Kampala",
			"Africa/Nairobi|Africa/Mogadishu",
			"Africa/Nairobi|Indian/Antananarivo",
			"Africa/Nairobi|Indian/Comoro",
			"Africa/Nairobi|Indian/Mayotte",
			"Africa/Tripoli|Libya",
			"America/Adak|America/Atka",
			"America/Adak|US/Aleutian",
			"America/Anchorage|America/Juneau",
			"America/Anchorage|America/Nome",
			"America/Anchorage|America/Sitka",
			"America/Anchorage|America/Yakutat",
			"America/Anchorage|US/Alaska",
			"America/Campo_Grande|America/Cuiaba",
			"America/Chicago|America/Indiana/Knox",
			"America/Chicago|America/Indiana/Tell_City",
			"America/Chicago|America/Knox_IN",
			"America/Chicago|America/Matamoros",
			"America/Chicago|America/Menominee",
			"America/Chicago|America/North_Dakota/Beulah",
			"America/Chicago|America/North_Dakota/Center",
			"America/Chicago|America/North_Dakota/New_Salem",
			"America/Chicago|America/Rainy_River",
			"America/Chicago|America/Rankin_Inlet",
			"America/Chicago|America/Resolute",
			"America/Chicago|America/Winnipeg",
			"America/Chicago|CST6CDT",
			"America/Chicago|Canada/Central",
			"America/Chicago|US/Central",
			"America/Chicago|US/Indiana-Starke",
			"America/Chihuahua|America/Mazatlan",
			"America/Chihuahua|Mexico/BajaSur",
			"America/Denver|America/Boise",
			"America/Denver|America/Cambridge_Bay",
			"America/Denver|America/Edmonton",
			"America/Denver|America/Inuvik",
			"America/Denver|America/Ojinaga",
			"America/Denver|America/Shiprock",
			"America/Denver|America/Yellowknife",
			"America/Denver|Canada/Mountain",
			"America/Denver|MST7MDT",
			"America/Denver|Navajo",
			"America/Denver|US/Mountain",
			"America/Fortaleza|America/Araguaina",
			"America/Fortaleza|America/Argentina/Buenos_Aires",
			"America/Fortaleza|America/Argentina/Catamarca",
			"America/Fortaleza|America/Argentina/ComodRivadavia",
			"America/Fortaleza|America/Argentina/Cordoba",
			"America/Fortaleza|America/Argentina/Jujuy",
			"America/Fortaleza|America/Argentina/La_Rioja",
			"America/Fortaleza|America/Argentina/Mendoza",
			"America/Fortaleza|America/Argentina/Rio_Gallegos",
			"America/Fortaleza|America/Argentina/Salta",
			"America/Fortaleza|America/Argentina/San_Juan",
			"America/Fortaleza|America/Argentina/San_Luis",
			"America/Fortaleza|America/Argentina/Tucuman",
			"America/Fortaleza|America/Argentina/Ushuaia",
			"America/Fortaleza|America/Bahia",
			"America/Fortaleza|America/Belem",
			"America/Fortaleza|America/Buenos_Aires",
			"America/Fortaleza|America/Catamarca",
			"America/Fortaleza|America/Cayenne",
			"America/Fortaleza|America/Cordoba",
			"America/Fortaleza|America/Jujuy",
			"America/Fortaleza|America/Maceio",
			"America/Fortaleza|America/Mendoza",
			"America/Fortaleza|America/Paramaribo",
			"America/Fortaleza|America/Recife",
			"America/Fortaleza|America/Rosario",
			"America/Fortaleza|America/Santarem",
			"America/Fortaleza|Antarctica/Rothera",
			"America/Fortaleza|Atlantic/Stanley",
			"America/Fortaleza|Etc/GMT+3",
			"America/Halifax|America/Glace_Bay",
			"America/Halifax|America/Goose_Bay",
			"America/Halifax|America/Moncton",
			"America/Halifax|America/Thule",
			"America/Halifax|Atlantic/Bermuda",
			"America/Halifax|Canada/Atlantic",
			"America/Havana|Cuba",
			"America/La_Paz|America/Boa_Vista",
			"America/La_Paz|America/Guyana",
			"America/La_Paz|America/Manaus",
			"America/La_Paz|America/Porto_Velho",
			"America/La_Paz|Brazil/West",
			"America/La_Paz|Etc/GMT+4",
			"America/Lima|America/Bogota",
			"America/Lima|America/Eirunepe",
			"America/Lima|America/Guayaquil",
			"America/Lima|America/Porto_Acre",
			"America/Lima|America/Rio_Branco",
			"America/Lima|Brazil/Acre",
			"America/Lima|Etc/GMT+5",
			"America/Los_Angeles|America/Dawson",
			"America/Los_Angeles|America/Ensenada",
			"America/Los_Angeles|America/Santa_Isabel",
			"America/Los_Angeles|America/Tijuana",
			"America/Los_Angeles|America/Vancouver",
			"America/Los_Angeles|America/Whitehorse",
			"America/Los_Angeles|Canada/Pacific",
			"America/Los_Angeles|Canada/Yukon",
			"America/Los_Angeles|Mexico/BajaNorte",
			"America/Los_Angeles|PST8PDT",
			"America/Los_Angeles|US/Pacific",
			"America/Los_Angeles|US/Pacific-New",
			"America/Managua|America/Belize",
			"America/Managua|America/Costa_Rica",
			"America/Managua|America/El_Salvador",
			"America/Managua|America/Guatemala",
			"America/Managua|America/Regina",
			"America/Managua|America/Swift_Current",
			"America/Managua|America/Tegucigalpa",
			"America/Managua|Canada/Saskatchewan",
			"America/Mexico_City|America/Bahia_Banderas",
			"America/Mexico_City|America/Merida",
			"America/Mexico_City|America/Monterrey",
			"America/Mexico_City|Mexico/General",
			"America/New_York|America/Detroit",
			"America/New_York|America/Fort_Wayne",
			"America/New_York|America/Indiana/Indianapolis",
			"America/New_York|America/Indiana/Marengo",
			"America/New_York|America/Indiana/Petersburg",
			"America/New_York|America/Indiana/Vevay",
			"America/New_York|America/Indiana/Vincennes",
			"America/New_York|America/Indiana/Winamac",
			"America/New_York|America/Indianapolis",
			"America/New_York|America/Iqaluit",
			"America/New_York|America/Kentucky/Louisville",
			"America/New_York|America/Kentucky/Monticello",
			"America/New_York|America/Louisville",
			"America/New_York|America/Montreal",
			"America/New_York|America/Nassau",
			"America/New_York|America/Nipigon",
			"America/New_York|America/Pangnirtung",
			"America/New_York|America/Thunder_Bay",
			"America/New_York|America/Toronto",
			"America/New_York|Canada/Eastern",
			"America/New_York|EST5EDT",
			"America/New_York|US/East-Indiana",
			"America/New_York|US/Eastern",
			"America/New_York|US/Michigan",
			"America/Noronha|Atlantic/South_Georgia",
			"America/Noronha|Brazil/DeNoronha",
			"America/Noronha|Etc/GMT+2",
			"America/Panama|America/Atikokan",
			"America/Panama|America/Cayman",
			"America/Panama|America/Coral_Harbour",
			"America/Panama|America/Jamaica",
			"America/Panama|EST",
			"America/Panama|Jamaica",
			"America/Phoenix|America/Creston",
			"America/Phoenix|America/Dawson_Creek",
			"America/Phoenix|America/Hermosillo",
			"America/Phoenix|MST",
			"America/Phoenix|US/Arizona",
			"America/Santiago|Chile/Continental",
			"America/Santo_Domingo|America/Anguilla",
			"America/Santo_Domingo|America/Antigua",
			"America/Santo_Domingo|America/Aruba",
			"America/Santo_Domingo|America/Barbados",
			"America/Santo_Domingo|America/Blanc-Sablon",
			"America/Santo_Domingo|America/Curacao",
			"America/Santo_Domingo|America/Dominica",
			"America/Santo_Domingo|America/Grenada",
			"America/Santo_Domingo|America/Guadeloupe",
			"America/Santo_Domingo|America/Kralendijk",
			"America/Santo_Domingo|America/Lower_Princes",
			"America/Santo_Domingo|America/Marigot",
			"America/Santo_Domingo|America/Martinique",
			"America/Santo_Domingo|America/Montserrat",
			"America/Santo_Domingo|America/Port_of_Spain",
			"America/Santo_Domingo|America/Puerto_Rico",
			"America/Santo_Domingo|America/St_Barthelemy",
			"America/Santo_Domingo|America/St_Kitts",
			"America/Santo_Domingo|America/St_Lucia",
			"America/Santo_Domingo|America/St_Thomas",
			"America/Santo_Domingo|America/St_Vincent",
			"America/Santo_Domingo|America/Tortola",
			"America/Santo_Domingo|America/Virgin",
			"America/Sao_Paulo|Brazil/East",
			"America/St_Johns|Canada/Newfoundland",
			"Antarctica/Palmer|America/Punta_Arenas",
			"Asia/Baghdad|Antarctica/Syowa",
			"Asia/Baghdad|Asia/Aden",
			"Asia/Baghdad|Asia/Bahrain",
			"Asia/Baghdad|Asia/Kuwait",
			"Asia/Baghdad|Asia/Qatar",
			"Asia/Baghdad|Asia/Riyadh",
			"Asia/Baghdad|Etc/GMT-3",
			"Asia/Baghdad|Europe/Minsk",
			"Asia/Bangkok|Antarctica/Davis",
			"Asia/Bangkok|Asia/Ho_Chi_Minh",
			"Asia/Bangkok|Asia/Novokuznetsk",
			"Asia/Bangkok|Asia/Phnom_Penh",
			"Asia/Bangkok|Asia/Saigon",
			"Asia/Bangkok|Asia/Vientiane",
			"Asia/Bangkok|Etc/GMT-7",
			"Asia/Bangkok|Indian/Christmas",
			"Asia/Dhaka|Antarctica/Vostok",
			"Asia/Dhaka|Asia/Almaty",
			"Asia/Dhaka|Asia/Bishkek",
			"Asia/Dhaka|Asia/Dacca",
			"Asia/Dhaka|Asia/Kashgar",
			"Asia/Dhaka|Asia/Qostanay",
			"Asia/Dhaka|Asia/Thimbu",
			"Asia/Dhaka|Asia/Thimphu",
			"Asia/Dhaka|Asia/Urumqi",
			"Asia/Dhaka|Etc/GMT-6",
			"Asia/Dhaka|Indian/Chagos",
			"Asia/Dili|Etc/GMT-9",
			"Asia/Dili|Pacific/Palau",
			"Asia/Dubai|Asia/Muscat",
			"Asia/Dubai|Asia/Tbilisi",
			"Asia/Dubai|Asia/Yerevan",
			"Asia/Dubai|Etc/GMT-4",
			"Asia/Dubai|Europe/Samara",
			"Asia/Dubai|Indian/Mahe",
			"Asia/Dubai|Indian/Mauritius",
			"Asia/Dubai|Indian/Reunion",
			"Asia/Gaza|Asia/Hebron",
			"Asia/Hong_Kong|Hongkong",
			"Asia/Jakarta|Asia/Pontianak",
			"Asia/Jerusalem|Asia/Tel_Aviv",
			"Asia/Jerusalem|Israel",
			"Asia/Kamchatka|Asia/Anadyr",
			"Asia/Kamchatka|Etc/GMT-12",
			"Asia/Kamchatka|Kwajalein",
			"Asia/Kamchatka|Pacific/Funafuti",
			"Asia/Kamchatka|Pacific/Kwajalein",
			"Asia/Kamchatka|Pacific/Majuro",
			"Asia/Kamchatka|Pacific/Nauru",
			"Asia/Kamchatka|Pacific/Tarawa",
			"Asia/Kamchatka|Pacific/Wake",
			"Asia/Kamchatka|Pacific/Wallis",
			"Asia/Kathmandu|Asia/Katmandu",
			"Asia/Kolkata|Asia/Calcutta",
			"Asia/Kuala_Lumpur|Asia/Brunei",
			"Asia/Kuala_Lumpur|Asia/Kuching",
			"Asia/Kuala_Lumpur|Asia/Singapore",
			"Asia/Kuala_Lumpur|Etc/GMT-8",
			"Asia/Kuala_Lumpur|Singapore",
			"Asia/Makassar|Asia/Ujung_Pandang",
			"Asia/Rangoon|Asia/Yangon",
			"Asia/Rangoon|Indian/Cocos",
			"Asia/Seoul|ROK",
			"Asia/Shanghai|Asia/Chongqing",
			"Asia/Shanghai|Asia/Chungking",
			"Asia/Shanghai|Asia/Harbin",
			"Asia/Shanghai|Asia/Macao",
			"Asia/Shanghai|Asia/Macau",
			"Asia/Shanghai|Asia/Taipei",
			"Asia/Shanghai|PRC",
			"Asia/Shanghai|ROC",
			"Asia/Tashkent|Antarctica/Mawson",
			"Asia/Tashkent|Asia/Aqtau",
			"Asia/Tashkent|Asia/Aqtobe",
			"Asia/Tashkent|Asia/Ashgabat",
			"Asia/Tashkent|Asia/Ashkhabad",
			"Asia/Tashkent|Asia/Atyrau",
			"Asia/Tashkent|Asia/Dushanbe",
			"Asia/Tashkent|Asia/Oral",
			"Asia/Tashkent|Asia/Samarkand",
			"Asia/Tashkent|Etc/GMT-5",
			"Asia/Tashkent|Indian/Kerguelen",
			"Asia/Tashkent|Indian/Maldives",
			"Asia/Tehran|Iran",
			"Asia/Tokyo|Japan",
			"Asia/Ulaanbaatar|Asia/Choibalsan",
			"Asia/Ulaanbaatar|Asia/Ulan_Bator",
			"Asia/Vladivostok|Asia/Ust-Nera",
			"Asia/Yakutsk|Asia/Khandyga",
			"Atlantic/Azores|America/Scoresbysund",
			"Atlantic/Cape_Verde|Etc/GMT+1",
			"Australia/Adelaide|Australia/Broken_Hill",
			"Australia/Adelaide|Australia/South",
			"Australia/Adelaide|Australia/Yancowinna",
			"Australia/Brisbane|Australia/Lindeman",
			"Australia/Brisbane|Australia/Queensland",
			"Australia/Darwin|Australia/North",
			"Australia/Lord_Howe|Australia/LHI",
			"Australia/Perth|Australia/West",
			"Australia/Sydney|Australia/ACT",
			"Australia/Sydney|Australia/Canberra",
			"Australia/Sydney|Australia/Currie",
			"Australia/Sydney|Australia/Hobart",
			"Australia/Sydney|Australia/Melbourne",
			"Australia/Sydney|Australia/NSW",
			"Australia/Sydney|Australia/Tasmania",
			"Australia/Sydney|Australia/Victoria",
			"Etc/UTC|Etc/UCT",
			"Etc/UTC|Etc/Universal",
			"Etc/UTC|Etc/Zulu",
			"Etc/UTC|UCT",
			"Etc/UTC|UTC",
			"Etc/UTC|Universal",
			"Etc/UTC|Zulu",
			"Europe/Athens|Asia/Nicosia",
			"Europe/Athens|EET",
			"Europe/Athens|Europe/Bucharest",
			"Europe/Athens|Europe/Helsinki",
			"Europe/Athens|Europe/Kiev",
			"Europe/Athens|Europe/Mariehamn",
			"Europe/Athens|Europe/Nicosia",
			"Europe/Athens|Europe/Riga",
			"Europe/Athens|Europe/Sofia",
			"Europe/Athens|Europe/Tallinn",
			"Europe/Athens|Europe/Uzhgorod",
			"Europe/Athens|Europe/Vilnius",
			"Europe/Athens|Europe/Zaporozhye",
			"Europe/Chisinau|Europe/Tiraspol",
			"Europe/Dublin|Eire",
			"Europe/Istanbul|Asia/Istanbul",
			"Europe/Istanbul|Turkey",
			"Europe/Lisbon|Atlantic/Canary",
			"Europe/Lisbon|Atlantic/Faeroe",
			"Europe/Lisbon|Atlantic/Faroe",
			"Europe/Lisbon|Atlantic/Madeira",
			"Europe/Lisbon|Portugal",
			"Europe/Lisbon|WET",
			"Europe/London|Europe/Belfast",
			"Europe/London|Europe/Guernsey",
			"Europe/London|Europe/Isle_of_Man",
			"Europe/London|Europe/Jersey",
			"Europe/London|GB",
			"Europe/London|GB-Eire",
			"Europe/Moscow|W-SU",
			"Europe/Paris|Africa/Ceuta",
			"Europe/Paris|Arctic/Longyearbyen",
			"Europe/Paris|Atlantic/Jan_Mayen",
			"Europe/Paris|CET",
			"Europe/Paris|Europe/Amsterdam",
			"Europe/Paris|Europe/Andorra",
			"Europe/Paris|Europe/Belgrade",
			"Europe/Paris|Europe/Berlin",
			"Europe/Paris|Europe/Bratislava",
			"Europe/Paris|Europe/Brussels",
			"Europe/Paris|Europe/Budapest",
			"Europe/Paris|Europe/Busingen",
			"Europe/Paris|Europe/Copenhagen",
			"Europe/Paris|Europe/Gibraltar",
			"Europe/Paris|Europe/Ljubljana",
			"Europe/Paris|Europe/Luxembourg",
			"Europe/Paris|Europe/Madrid",
			"Europe/Paris|Europe/Malta",
			"Europe/Paris|Europe/Monaco",
			"Europe/Paris|Europe/Oslo",
			"Europe/Paris|Europe/Podgorica",
			"Europe/Paris|Europe/Prague",
			"Europe/Paris|Europe/Rome",
			"Europe/Paris|Europe/San_Marino",
			"Europe/Paris|Europe/Sarajevo",
			"Europe/Paris|Europe/Skopje",
			"Europe/Paris|Europe/Stockholm",
			"Europe/Paris|Europe/Tirane",
			"Europe/Paris|Europe/Vaduz",
			"Europe/Paris|Europe/Vatican",
			"Europe/Paris|Europe/Vienna",
			"Europe/Paris|Europe/Warsaw",
			"Europe/Paris|Europe/Zagreb",
			"Europe/Paris|Europe/Zurich",
			"Europe/Paris|Poland",
			"Europe/Ulyanovsk|Europe/Astrakhan",
			"Pacific/Auckland|Antarctica/McMurdo",
			"Pacific/Auckland|Antarctica/South_Pole",
			"Pacific/Auckland|NZ",
			"Pacific/Chatham|NZ-CHAT",
			"Pacific/Easter|Chile/EasterIsland",
			"Pacific/Fakaofo|Etc/GMT-13",
			"Pacific/Fakaofo|Pacific/Enderbury",
			"Pacific/Galapagos|Etc/GMT+6",
			"Pacific/Gambier|Etc/GMT+9",
			"Pacific/Guadalcanal|Antarctica/Macquarie",
			"Pacific/Guadalcanal|Etc/GMT-11",
			"Pacific/Guadalcanal|Pacific/Efate",
			"Pacific/Guadalcanal|Pacific/Kosrae",
			"Pacific/Guadalcanal|Pacific/Noumea",
			"Pacific/Guadalcanal|Pacific/Pohnpei",
			"Pacific/Guadalcanal|Pacific/Ponape",
			"Pacific/Guam|Pacific/Saipan",
			"Pacific/Honolulu|HST",
			"Pacific/Honolulu|Pacific/Johnston",
			"Pacific/Honolulu|US/Hawaii",
			"Pacific/Kiritimati|Etc/GMT-14",
			"Pacific/Niue|Etc/GMT+11",
			"Pacific/Pago_Pago|Pacific/Midway",
			"Pacific/Pago_Pago|Pacific/Samoa",
			"Pacific/Pago_Pago|US/Samoa",
			"Pacific/Pitcairn|Etc/GMT+8",
			"Pacific/Port_Moresby|Antarctica/DumontDUrville",
			"Pacific/Port_Moresby|Etc/GMT-10",
			"Pacific/Port_Moresby|Pacific/Chuuk",
			"Pacific/Port_Moresby|Pacific/Truk",
			"Pacific/Port_Moresby|Pacific/Yap",
			"Pacific/Tahiti|Etc/GMT+10",
			"Pacific/Tahiti|Pacific/Rarotonga"
		]
	});


	return moment;
}));
//! moment.js locale configuration

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['../moment'], factory) :
   factory(global.moment)
}(this, (function (moment) { 'use strict';


    function plural(word, num) {
        var forms = word.split('_');
        return num % 10 === 1 && num % 100 !== 11 ? forms[0] : (num % 10 >= 2 && num % 10 <= 4 && (num % 100 < 10 || num % 100 >= 20) ? forms[1] : forms[2]);
    }
    function relativeTimeWithPlural(number, withoutSuffix, key) {
        var format = {
            'ss': withoutSuffix ? 'секунда_секунди_секунд' : 'секунду_секунди_секунд',
            'mm': withoutSuffix ? 'хвилина_хвилини_хвилин' : 'хвилину_хвилини_хвилин',
            'hh': withoutSuffix ? 'година_години_годин' : 'годину_години_годин',
            'dd': 'день_дні_днів',
            'MM': 'місяць_місяці_місяців',
            'yy': 'рік_роки_років'
        };
        if (key === 'm') {
            return withoutSuffix ? 'хвилина' : 'хвилину';
        }
        else if (key === 'h') {
            return withoutSuffix ? 'година' : 'годину';
        }
        else {
            return number + ' ' + plural(format[key], +number);
        }
    }
    function weekdaysCaseReplace(m, format) {
        var weekdays = {
            'nominative': 'неділя_понеділок_вівторок_середа_четвер_п’ятниця_субота'.split('_'),
            'accusative': 'неділю_понеділок_вівторок_середу_четвер_п’ятницю_суботу'.split('_'),
            'genitive': 'неділі_понеділка_вівторка_середи_четверга_п’ятниці_суботи'.split('_')
        };

        if (m === true) {
            return weekdays['nominative'].slice(1, 7).concat(weekdays['nominative'].slice(0, 1));
        }
        if (!m) {
            return weekdays['nominative'];
        }

        var nounCase = (/(\[[ВвУу]\]) ?dddd/).test(format) ?
            'accusative' :
            ((/\[?(?:минулої|наступної)? ?\] ?dddd/).test(format) ?
                'genitive' :
                'nominative');
        return weekdays[nounCase][m.day()];
    }
    function processHoursFunction(str) {
        return function () {
            return str + 'о' + (this.hours() === 11 ? 'б' : '') + '] LT';
        };
    }

    var uk = moment.defineLocale('uk', {
        months : {
            'format': 'січня_лютого_березня_квітня_травня_червня_липня_серпня_вересня_жовтня_листопада_грудня'.split('_'),
            'standalone': 'січень_лютий_березень_квітень_травень_червень_липень_серпень_вересень_жовтень_листопад_грудень'.split('_')
        },
        monthsShort : 'січ_лют_бер_квіт_трав_черв_лип_серп_вер_жовт_лист_груд'.split('_'),
        weekdays : weekdaysCaseReplace,
        weekdaysShort : 'нд_пн_вт_ср_чт_пт_сб'.split('_'),
        weekdaysMin : 'нд_пн_вт_ср_чт_пт_сб'.split('_'),
        longDateFormat : {
            LT : 'HH:mm',
            LTS : 'HH:mm:ss',
            L : 'DD.MM.YYYY',
            LL : 'D MMMM YYYY р.',
            LLL : 'D MMMM YYYY р., HH:mm',
            LLLL : 'dddd, D MMMM YYYY р., HH:mm'
        },
        calendar : {
            sameDay: processHoursFunction('[Сьогодні '),
            nextDay: processHoursFunction('[Завтра '),
            lastDay: processHoursFunction('[Вчора '),
            nextWeek: processHoursFunction('[У] dddd ['),
            lastWeek: function () {
                switch (this.day()) {
                    case 0:
                    case 3:
                    case 5:
                    case 6:
                        return processHoursFunction('[Минулої] dddd [').call(this);
                    case 1:
                    case 2:
                    case 4:
                        return processHoursFunction('[Минулого] dddd [').call(this);
                }
            },
            sameElse: 'L'
        },
        relativeTime : {
            future : 'за %s',
            past : '%s тому',
            s : 'декілька секунд',
            ss : relativeTimeWithPlural,
            m : relativeTimeWithPlural,
            mm : relativeTimeWithPlural,
            h : 'годину',
            hh : relativeTimeWithPlural,
            d : 'день',
            dd : relativeTimeWithPlural,
            M : 'місяць',
            MM : relativeTimeWithPlural,
            y : 'рік',
            yy : relativeTimeWithPlural
        },
        // M. E.: those two are virtually unused but a user might want to implement them for his/her website for some reason
        meridiemParse: /ночі|ранку|дня|вечора/,
        isPM: function (input) {
            return /^(дня|вечора)$/.test(input);
        },
        meridiem : function (hour, minute, isLower) {
            if (hour < 4) {
                return 'ночі';
            } else if (hour < 12) {
                return 'ранку';
            } else if (hour < 17) {
                return 'дня';
            } else {
                return 'вечора';
            }
        },
        dayOfMonthOrdinalParse: /\d{1,2}-(й|го)/,
        ordinal: function (number, period) {
            switch (period) {
                case 'M':
                case 'd':
                case 'DDD':
                case 'w':
                case 'W':
                    return number + '-й';
                case 'D':
                    return number + '-го';
                default:
                    return number;
            }
        },
        week : {
            dow : 1, // Monday is the first day of the week.
            doy : 7  // The week that contains Jan 7th is the first week of the year.
        }
    });

    return uk;

})));

// moment-timezone-localization for lang code: uk

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['../moment'], factory) :
   factory(global.moment)
}(this, (function (moment) { 'use strict';


moment.tz.localizedNames = function() {
  return [{"value":"Africa/Abidjan","name":"Абіджан","id":"Africa/Abidjan"},{"value":"Africa/Accra","name":"Аккра","id":"Africa/Accra"},{"value":"Africa/Addis_Ababa","name":"Аддис-Абеба","id":"Africa/Addis_Ababa"},{"value":"Africa/Algiers","name":"Алжир","id":"Africa/Algiers"},{"value":"Africa/Asmera","name":"Асмера","id":"Africa/Asmera"},{"value":"Africa/Bamako","name":"Бамако","id":"Africa/Bamako"},{"value":"Africa/Bangui","name":"Банґі","id":"Africa/Bangui"},{"value":"Africa/Banjul","name":"Банжул","id":"Africa/Banjul"},{"value":"Africa/Bissau","name":"Бісау","id":"Africa/Bissau"},{"value":"Africa/Blantyre","name":"Блантайр","id":"Africa/Blantyre"},{"value":"Africa/Brazzaville","name":"Браззавіль","id":"Africa/Brazzaville"},{"value":"Africa/Bujumbura","name":"Бужумбура","id":"Africa/Bujumbura"},{"value":"Africa/Cairo","name":"Каїр","id":"Africa/Cairo"},{"value":"Africa/Casablanca","name":"Касабланка","id":"Africa/Casablanca"},{"value":"Africa/Ceuta","name":"Сеута","id":"Africa/Ceuta"},{"value":"Africa/Conakry","name":"Конакрі","id":"Africa/Conakry"},{"value":"Africa/Dakar","name":"Дакар","id":"Africa/Dakar"},{"value":"Africa/Dar_es_Salaam","name":"Дар-ес-Салам","id":"Africa/Dar_es_Salaam"},{"value":"Africa/Djibouti","name":"Джібуті","id":"Africa/Djibouti"},{"value":"Africa/Douala","name":"Дуала","id":"Africa/Douala"},{"value":"Africa/El_Aaiun","name":"Ель-Аюн","id":"Africa/El_Aaiun"},{"value":"Africa/Freetown","name":"Фрітаун","id":"Africa/Freetown"},{"value":"Africa/Gaborone","name":"Ґабороне","id":"Africa/Gaborone"},{"value":"Africa/Harare","name":"Хараре","id":"Africa/Harare"},{"value":"Africa/Johannesburg","name":"Йоганнесбурґ","id":"Africa/Johannesburg"},{"value":"Africa/Juba","name":"Джуба","id":"Africa/Juba"},{"value":"Africa/Kampala","name":"Кампала","id":"Africa/Kampala"},{"value":"Africa/Khartoum","name":"Хартум","id":"Africa/Khartoum"},{"value":"Africa/Kigali","name":"Кігалі","id":"Africa/Kigali"},{"value":"Africa/Kinshasa","name":"Кіншаса","id":"Africa/Kinshasa"},{"value":"Africa/Lagos","name":"Лаґос","id":"Africa/Lagos"},{"value":"Africa/Libreville","name":"Лібревіль","id":"Africa/Libreville"},{"value":"Africa/Lome","name":"Ломе","id":"Africa/Lome"},{"value":"Africa/Luanda","name":"Луанда","id":"Africa/Luanda"},{"value":"Africa/Lubumbashi","name":"Лубумбаші","id":"Africa/Lubumbashi"},{"value":"Africa/Lusaka","name":"Лусака","id":"Africa/Lusaka"},{"value":"Africa/Malabo","name":"Малабо","id":"Africa/Malabo"},{"value":"Africa/Maputo","name":"Мапуту","id":"Africa/Maputo"},{"value":"Africa/Maseru","name":"Масеру","id":"Africa/Maseru"},{"value":"Africa/Mbabane","name":"Мбабане","id":"Africa/Mbabane"},{"value":"Africa/Mogadishu","name":"Моґадішо","id":"Africa/Mogadishu"},{"value":"Africa/Monrovia","name":"Монровія","id":"Africa/Monrovia"},{"value":"Africa/Nairobi","name":"Найробі","id":"Africa/Nairobi"},{"value":"Africa/Ndjamena","name":"Нджамена","id":"Africa/Ndjamena"},{"value":"Africa/Niamey","name":"Ніамей","id":"Africa/Niamey"},{"value":"Africa/Nouakchott","name":"Нуакшотт","id":"Africa/Nouakchott"},{"value":"Africa/Ouagadougou","name":"Уаґадуґу","id":"Africa/Ouagadougou"},{"value":"Africa/Porto-Novo","name":"Порто-Ново","id":"Africa/Porto-Novo"},{"value":"Africa/Sao_Tome","name":"Сан-Томе","id":"Africa/Sao_Tome"},{"value":"Africa/Tripoli","name":"Тріполі","id":"Africa/Tripoli"},{"value":"Africa/Tunis","name":"Туніс","id":"Africa/Tunis"},{"value":"Africa/Windhoek","name":"Віндгук","id":"Africa/Windhoek"},{"value":"America/Adak","name":"Адак","id":"America/Adak"},{"value":"America/Anchorage","name":"Анкоридж","id":"America/Anchorage"},{"value":"America/Anguilla","name":"Анґілья","id":"America/Anguilla"},{"value":"America/Antigua","name":"Антиґуа","id":"America/Antigua"},{"value":"America/Araguaina","name":"Араґуаіна","id":"America/Araguaina"},{"value":"America/Argentina/La_Rioja","name":"Ла-Ріоха","id":"America/Argentina/La_Rioja"},{"value":"America/Argentina/Rio_Gallegos","name":"Ріо-Ґальєґос","id":"America/Argentina/Rio_Gallegos"},{"value":"America/Argentina/Salta","name":"Сальта","id":"America/Argentina/Salta"},{"value":"America/Argentina/San_Juan","name":"Сан-Хуан","id":"America/Argentina/San_Juan"},{"value":"America/Argentina/San_Luis","name":"Сан-Луїс","id":"America/Argentina/San_Luis"},{"value":"America/Argentina/Tucuman","name":"Тукуман","id":"America/Argentina/Tucuman"},{"value":"America/Argentina/Ushuaia","name":"Ушуая","id":"America/Argentina/Ushuaia"},{"value":"America/Aruba","name":"Аруба","id":"America/Aruba"},{"value":"America/Asuncion","name":"Асунсьйон","id":"America/Asuncion"},{"value":"America/Bahia","name":"Байя","id":"America/Bahia"},{"value":"America/Bahia_Banderas","name":"Баїя Бандерас","id":"America/Bahia_Banderas"},{"value":"America/Barbados","name":"Барбадос","id":"America/Barbados"},{"value":"America/Belem","name":"Белен","id":"America/Belem"},{"value":"America/Belize","name":"Беліз","id":"America/Belize"},{"value":"America/Blanc-Sablon","name":"Блан-Саблон","id":"America/Blanc-Sablon"},{"value":"America/Boa_Vista","name":"Боа-Віста","id":"America/Boa_Vista"},{"value":"America/Bogota","name":"Боґота","id":"America/Bogota"},{"value":"America/Boise","name":"Бойсе","id":"America/Boise"},{"value":"America/Buenos_Aires","name":"Буенос-Айрес","id":"America/Buenos_Aires"},{"value":"America/Cambridge_Bay","name":"Кеймбрідж-Бей","id":"America/Cambridge_Bay"},{"value":"America/Campo_Grande","name":"Кампу-Ґранді","id":"America/Campo_Grande"},{"value":"America/Cancun","name":"Канкун","id":"America/Cancun"},{"value":"America/Caracas","name":"Каракас","id":"America/Caracas"},{"value":"America/Catamarca","name":"Катамарка","id":"America/Catamarca"},{"value":"America/Cayenne","name":"Каєнна","id":"America/Cayenne"},{"value":"America/Cayman","name":"Кайманові Острови","id":"America/Cayman"},{"value":"America/Chicago","name":"Чікаґо","id":"America/Chicago"},{"value":"America/Chihuahua","name":"Чіуауа","id":"America/Chihuahua"},{"value":"America/Coral_Harbour","name":"Атікокан","id":"America/Coral_Harbour"},{"value":"America/Cordoba","name":"Кордова","id":"America/Cordoba"},{"value":"America/Costa_Rica","name":"Коста-Ріка","id":"America/Costa_Rica"},{"value":"America/Creston","name":"Крестон","id":"America/Creston"},{"value":"America/Cuiaba","name":"Куяба","id":"America/Cuiaba"},{"value":"America/Curacao","name":"Кюрасао","id":"America/Curacao"},{"value":"America/Danmarkshavn","name":"Денмарксхавн","id":"America/Danmarkshavn"},{"value":"America/Dawson","name":"Доусон","id":"America/Dawson"},{"value":"America/Dawson_Creek","name":"Доусон-Крік","id":"America/Dawson_Creek"},{"value":"America/Denver","name":"Денвер","id":"America/Denver"},{"value":"America/Detroit","name":"Детройт","id":"America/Detroit"},{"value":"America/Dominica","name":"Домініка","id":"America/Dominica"},{"value":"America/Edmonton","name":"Едмонтон","id":"America/Edmonton"},{"value":"America/Eirunepe","name":"Ейрунепе","id":"America/Eirunepe"},{"value":"America/El_Salvador","name":"Сальвадор","id":"America/El_Salvador"},{"value":"America/Fort_Nelson","name":"Форт Нельсон","id":"America/Fort_Nelson"},{"value":"America/Fortaleza","name":"Форталеза","id":"America/Fortaleza"},{"value":"America/Glace_Bay","name":"Ґлейс-Бей","id":"America/Glace_Bay"},{"value":"America/Godthab","name":"Нуук","id":"America/Godthab"},{"value":"America/Goose_Bay","name":"Ґус-Бей","id":"America/Goose_Bay"},{"value":"America/Grand_Turk","name":"Ґранд-Терк","id":"America/Grand_Turk"},{"value":"America/Grenada","name":"Ґренада","id":"America/Grenada"},{"value":"America/Guadeloupe","name":"Ґваделупа","id":"America/Guadeloupe"},{"value":"America/Guatemala","name":"Ґватемала","id":"America/Guatemala"},{"value":"America/Guayaquil","name":"Ґуаякіль","id":"America/Guayaquil"},{"value":"America/Guyana","name":"Ґайана","id":"America/Guyana"},{"value":"America/Halifax","name":"Галіфакс","id":"America/Halifax"},{"value":"America/Havana","name":"Гавана","id":"America/Havana"},{"value":"America/Hermosillo","name":"Ермосільйо","id":"America/Hermosillo"},{"value":"America/Indiana/Knox","name":"Нокс, Індіана","id":"America/Indiana/Knox"},{"value":"America/Indiana/Marengo","name":"Маренго, Індіана","id":"America/Indiana/Marengo"},{"value":"America/Indiana/Petersburg","name":"Пітерсберг, Індіана","id":"America/Indiana/Petersburg"},{"value":"America/Indiana/Tell_City","name":"Телл-Сіті, Індіана","id":"America/Indiana/Tell_City"},{"value":"America/Indiana/Vevay","name":"Вівей, Індіана","id":"America/Indiana/Vevay"},{"value":"America/Indiana/Vincennes","name":"Вінсенс, Індіана","id":"America/Indiana/Vincennes"},{"value":"America/Indiana/Winamac","name":"Вінамак, Індіана","id":"America/Indiana/Winamac"},{"value":"America/Indianapolis","name":"Індіанаполіс","id":"America/Indianapolis"},{"value":"America/Inuvik","name":"Інувік","id":"America/Inuvik"},{"value":"America/Iqaluit","name":"Ікалуїт","id":"America/Iqaluit"},{"value":"America/Jamaica","name":"Ямайка","id":"America/Jamaica"},{"value":"America/Jujuy","name":"Жужуй","id":"America/Jujuy"},{"value":"America/Juneau","name":"Джуно","id":"America/Juneau"},{"value":"America/Kentucky/Monticello","name":"Монтіселло, Кентуккі","id":"America/Kentucky/Monticello"},{"value":"America/Kralendijk","name":"Кралендейк","id":"America/Kralendijk"},{"value":"America/La_Paz","name":"Ла-Пас","id":"America/La_Paz"},{"value":"America/Lima","name":"Ліма","id":"America/Lima"},{"value":"America/Los_Angeles","name":"Лос-Анджелес","id":"America/Los_Angeles"},{"value":"America/Louisville","name":"Луїсвілл","id":"America/Louisville"},{"value":"America/Lower_Princes","name":"Лоуер-Принсес-Квотер","id":"America/Lower_Princes"},{"value":"America/Maceio","name":"Масейо","id":"America/Maceio"},{"value":"America/Managua","name":"Манаґуа","id":"America/Managua"},{"value":"America/Manaus","name":"Манаус","id":"America/Manaus"},{"value":"America/Marigot","name":"Маріґо","id":"America/Marigot"},{"value":"America/Martinique","name":"Мартініка","id":"America/Martinique"},{"value":"America/Matamoros","name":"Матаморос","id":"America/Matamoros"},{"value":"America/Mazatlan","name":"Масатлан","id":"America/Mazatlan"},{"value":"America/Mendoza","name":"Мендоса","id":"America/Mendoza"},{"value":"America/Menominee","name":"Меноміні","id":"America/Menominee"},{"value":"America/Merida","name":"Меріда","id":"America/Merida"},{"value":"America/Metlakatla","name":"Метлакатла","id":"America/Metlakatla"},{"value":"America/Mexico_City","name":"Мехіко","id":"America/Mexico_City"},{"value":"America/Miquelon","name":"Мікелон","id":"America/Miquelon"},{"value":"America/Moncton","name":"Монктон","id":"America/Moncton"},{"value":"America/Monterrey","name":"Монтерей","id":"America/Monterrey"},{"value":"America/Montevideo","name":"Монтевідео","id":"America/Montevideo"},{"value":"America/Montserrat","name":"Монтсеррат","id":"America/Montserrat"},{"value":"America/Nassau","name":"Насау","id":"America/Nassau"},{"value":"America/New_York","name":"Нью-Йорк","id":"America/New_York"},{"value":"America/Nipigon","name":"Ніпігон","id":"America/Nipigon"},{"value":"America/Nome","name":"Ном","id":"America/Nome"},{"value":"America/Noronha","name":"Норонья","id":"America/Noronha"},{"value":"America/North_Dakota/Beulah","name":"Бʼюла, Північна Дакота","id":"America/North_Dakota/Beulah"},{"value":"America/North_Dakota/Center","name":"Сентр, Північна Дакота","id":"America/North_Dakota/Center"},{"value":"America/North_Dakota/New_Salem","name":"Нью-Салем, Північна Дакота","id":"America/North_Dakota/New_Salem"},{"value":"America/Ojinaga","name":"Охінаґа","id":"America/Ojinaga"},{"value":"America/Panama","name":"Панама","id":"America/Panama"},{"value":"America/Pangnirtung","name":"Панґніртанґ","id":"America/Pangnirtung"},{"value":"America/Paramaribo","name":"Парамарибо","id":"America/Paramaribo"},{"value":"America/Phoenix","name":"Фінікс","id":"America/Phoenix"},{"value":"America/Port-au-Prince","name":"Порт-о-Пренс","id":"America/Port-au-Prince"},{"value":"America/Port_of_Spain","name":"Порт-оф-Спейн","id":"America/Port_of_Spain"},{"value":"America/Porto_Velho","name":"Порту-Велью","id":"America/Porto_Velho"},{"value":"America/Puerto_Rico","name":"Пуерто-Ріко","id":"America/Puerto_Rico"},{"value":"America/Punta_Arenas","name":"Пунта-Аренас","id":"America/Punta_Arenas"},{"value":"America/Rainy_River","name":"Рейні-Рівер","id":"America/Rainy_River"},{"value":"America/Rankin_Inlet","name":"Ренкін-Інлет","id":"America/Rankin_Inlet"},{"value":"America/Recife","name":"Ресіфі","id":"America/Recife"},{"value":"America/Regina","name":"Реджайна","id":"America/Regina"},{"value":"America/Resolute","name":"Резольют","id":"America/Resolute"},{"value":"America/Rio_Branco","name":"Ріо-Бранко","id":"America/Rio_Branco"},{"value":"America/Santa_Isabel","name":"Санта-Ісабель","id":"America/Santa_Isabel"},{"value":"America/Santarem","name":"Сантарен","id":"America/Santarem"},{"value":"America/Santiago","name":"Сантьяґо","id":"America/Santiago"},{"value":"America/Santo_Domingo","name":"Санто-Домінґо","id":"America/Santo_Domingo"},{"value":"America/Sao_Paulo","name":"Сан-Паулу","id":"America/Sao_Paulo"},{"value":"America/Scoresbysund","name":"Іттоккортоорміут","id":"America/Scoresbysund"},{"value":"America/Sitka","name":"Сітка","id":"America/Sitka"},{"value":"America/St_Barthelemy","name":"Сен-Бартелемі","id":"America/St_Barthelemy"},{"value":"America/St_Johns","name":"Сент-Джонс","id":"America/St_Johns"},{"value":"America/St_Kitts","name":"Сент-Кіттс","id":"America/St_Kitts"},{"value":"America/St_Lucia","name":"Сент-Люсія","id":"America/St_Lucia"},{"value":"America/St_Thomas","name":"Сент-Томас","id":"America/St_Thomas"},{"value":"America/St_Vincent","name":"Сент-Вінсент","id":"America/St_Vincent"},{"value":"America/Swift_Current","name":"Свіфт-Каррент","id":"America/Swift_Current"},{"value":"America/Tegucigalpa","name":"Теґусіґальпа","id":"America/Tegucigalpa"},{"value":"America/Thule","name":"Туле","id":"America/Thule"},{"value":"America/Thunder_Bay","name":"Тандер-Бей","id":"America/Thunder_Bay"},{"value":"America/Tijuana","name":"Тіхуана","id":"America/Tijuana"},{"value":"America/Toronto","name":"Торонто","id":"America/Toronto"},{"value":"America/Tortola","name":"Тортола","id":"America/Tortola"},{"value":"America/Vancouver","name":"Ванкувер","id":"America/Vancouver"},{"value":"America/Whitehorse","name":"Вайтгорс","id":"America/Whitehorse"},{"value":"America/Winnipeg","name":"Вінніпеґ","id":"America/Winnipeg"},{"value":"America/Yakutat","name":"Якутат","id":"America/Yakutat"},{"value":"America/Yellowknife","name":"Єллоунайф","id":"America/Yellowknife"},{"value":"Antarctica/Casey","name":"Кейсі","id":"Antarctica/Casey"},{"value":"Antarctica/Davis","name":"Девіс","id":"Antarctica/Davis"},{"value":"Antarctica/DumontDUrville","name":"Дюмон-дʼЮрвіль","id":"Antarctica/DumontDUrville"},{"value":"Antarctica/Macquarie","name":"Маккуорі","id":"Antarctica/Macquarie"},{"value":"Antarctica/Mawson","name":"Моусон","id":"Antarctica/Mawson"},{"value":"Antarctica/McMurdo","name":"Мак-Мердо","id":"Antarctica/McMurdo"},{"value":"Antarctica/Palmer","name":"Палмер","id":"Antarctica/Palmer"},{"value":"Antarctica/Rothera","name":"Ротера","id":"Antarctica/Rothera"},{"value":"Antarctica/Syowa","name":"Сьова","id":"Antarctica/Syowa"},{"value":"Antarctica/Troll","name":"Тролл","id":"Antarctica/Troll"},{"value":"Antarctica/Vostok","name":"Восток","id":"Antarctica/Vostok"},{"value":"Arctic/Longyearbyen","name":"Лонґйїр","id":"Arctic/Longyearbyen"},{"value":"Asia/Aden","name":"Аден","id":"Asia/Aden"},{"value":"Asia/Almaty","name":"Алмати","id":"Asia/Almaty"},{"value":"Asia/Amman","name":"Амман","id":"Asia/Amman"},{"value":"Asia/Anadyr","name":"Анадир","id":"Asia/Anadyr"},{"value":"Asia/Aqtau","name":"Актау","id":"Asia/Aqtau"},{"value":"Asia/Aqtobe","name":"Актобе","id":"Asia/Aqtobe"},{"value":"Asia/Ashgabat","name":"Ашгабат","id":"Asia/Ashgabat"},{"value":"Asia/Atyrau","name":"Атирау","id":"Asia/Atyrau"},{"value":"Asia/Baghdad","name":"Багдад","id":"Asia/Baghdad"},{"value":"Asia/Bahrain","name":"Бахрейн","id":"Asia/Bahrain"},{"value":"Asia/Baku","name":"Баку","id":"Asia/Baku"},{"value":"Asia/Bangkok","name":"Банґкок","id":"Asia/Bangkok"},{"value":"Asia/Barnaul","name":"Барнаул","id":"Asia/Barnaul"},{"value":"Asia/Beirut","name":"Бейрут","id":"Asia/Beirut"},{"value":"Asia/Bishkek","name":"Бішкек","id":"Asia/Bishkek"},{"value":"Asia/Brunei","name":"Бруней","id":"Asia/Brunei"},{"value":"Asia/Calcutta","name":"Колката","id":"Asia/Calcutta"},{"value":"Asia/Chita","name":"Чита","id":"Asia/Chita"},{"value":"Asia/Choibalsan","name":"Чойбалсан","id":"Asia/Choibalsan"},{"value":"Asia/Colombo","name":"Коломбо","id":"Asia/Colombo"},{"value":"Asia/Damascus","name":"Дамаск","id":"Asia/Damascus"},{"value":"Asia/Dhaka","name":"Дакка","id":"Asia/Dhaka"},{"value":"Asia/Dili","name":"Ділі","id":"Asia/Dili"},{"value":"Asia/Dubai","name":"Дубай","id":"Asia/Dubai"},{"value":"Asia/Dushanbe","name":"Душанбе","id":"Asia/Dushanbe"},{"value":"Asia/Famagusta","name":"Фамагуста","id":"Asia/Famagusta"},{"value":"Asia/Gaza","name":"Газа","id":"Asia/Gaza"},{"value":"Asia/Hebron","name":"Хеврон","id":"Asia/Hebron"},{"value":"Asia/Hong_Kong","name":"Гонконґ","id":"Asia/Hong_Kong"},{"value":"Asia/Hovd","name":"Ховд","id":"Asia/Hovd"},{"value":"Asia/Irkutsk","name":"Іркутськ","id":"Asia/Irkutsk"},{"value":"Asia/Jakarta","name":"Джакарта","id":"Asia/Jakarta"},{"value":"Asia/Jayapura","name":"Джайпур","id":"Asia/Jayapura"},{"value":"Asia/Jerusalem","name":"Єрусалим","id":"Asia/Jerusalem"},{"value":"Asia/Kabul","name":"Кабул","id":"Asia/Kabul"},{"value":"Asia/Kamchatka","name":"Камчатка","id":"Asia/Kamchatka"},{"value":"Asia/Karachi","name":"Карачі","id":"Asia/Karachi"},{"value":"Asia/Katmandu","name":"Катманду","id":"Asia/Katmandu"},{"value":"Asia/Khandyga","name":"Хандига","id":"Asia/Khandyga"},{"value":"Asia/Krasnoyarsk","name":"Красноярськ","id":"Asia/Krasnoyarsk"},{"value":"Asia/Kuala_Lumpur","name":"Куала-Лумпур","id":"Asia/Kuala_Lumpur"},{"value":"Asia/Kuching","name":"Кучінґ","id":"Asia/Kuching"},{"value":"Asia/Kuwait","name":"Кувейт","id":"Asia/Kuwait"},{"value":"Asia/Macau","name":"Макао","id":"Asia/Macau"},{"value":"Asia/Magadan","name":"Магадан","id":"Asia/Magadan"},{"value":"Asia/Makassar","name":"Макассар","id":"Asia/Makassar"},{"value":"Asia/Manila","name":"Маніла","id":"Asia/Manila"},{"value":"Asia/Muscat","name":"Маскат","id":"Asia/Muscat"},{"value":"Asia/Nicosia","name":"Нікосія","id":"Asia/Nicosia"},{"value":"Asia/Novokuznetsk","name":"Новокузнецьк","id":"Asia/Novokuznetsk"},{"value":"Asia/Novosibirsk","name":"Новосибірськ","id":"Asia/Novosibirsk"},{"value":"Asia/Omsk","name":"Омськ","id":"Asia/Omsk"},{"value":"Asia/Oral","name":"Орал","id":"Asia/Oral"},{"value":"Asia/Phnom_Penh","name":"Пномпень","id":"Asia/Phnom_Penh"},{"value":"Asia/Pontianak","name":"Понтіанак","id":"Asia/Pontianak"},{"value":"Asia/Pyongyang","name":"Пхеньян","id":"Asia/Pyongyang"},{"value":"Asia/Qatar","name":"Катар","id":"Asia/Qatar"},{"value":"Asia/Qyzylorda","name":"Кизилорда","id":"Asia/Qyzylorda"},{"value":"Asia/Rangoon","name":"Янґон","id":"Asia/Rangoon"},{"value":"Asia/Riyadh","name":"Ер-Ріяд","id":"Asia/Riyadh"},{"value":"Asia/Saigon","name":"Хошимін","id":"Asia/Saigon"},{"value":"Asia/Sakhalin","name":"Сахалін","id":"Asia/Sakhalin"},{"value":"Asia/Samarkand","name":"Самарканд","id":"Asia/Samarkand"},{"value":"Asia/Seoul","name":"Сеул","id":"Asia/Seoul"},{"value":"Asia/Shanghai","name":"Шанхай","id":"Asia/Shanghai"},{"value":"Asia/Singapore","name":"Сінґапур","id":"Asia/Singapore"},{"value":"Asia/Srednekolymsk","name":"Середньоколимськ","id":"Asia/Srednekolymsk"},{"value":"Asia/Taipei","name":"Тайбей","id":"Asia/Taipei"},{"value":"Asia/Tashkent","name":"Ташкент","id":"Asia/Tashkent"},{"value":"Asia/Tbilisi","name":"Тбілісі","id":"Asia/Tbilisi"},{"value":"Asia/Tehran","name":"Тегеран","id":"Asia/Tehran"},{"value":"Asia/Thimphu","name":"Тхімпху","id":"Asia/Thimphu"},{"value":"Asia/Tokyo","name":"Токіо","id":"Asia/Tokyo"},{"value":"Asia/Tomsk","name":"Томськ","id":"Asia/Tomsk"},{"value":"Asia/Ulaanbaatar","name":"Улан-Батор","id":"Asia/Ulaanbaatar"},{"value":"Asia/Urumqi","name":"Урумчі","id":"Asia/Urumqi"},{"value":"Asia/Ust-Nera","name":"Усть-Нера","id":"Asia/Ust-Nera"},{"value":"Asia/Vientiane","name":"Вʼєнтьян","id":"Asia/Vientiane"},{"value":"Asia/Vladivostok","name":"Владивосток","id":"Asia/Vladivostok"},{"value":"Asia/Yakutsk","name":"Якутськ","id":"Asia/Yakutsk"},{"value":"Asia/Yekaterinburg","name":"Єкатеринбург","id":"Asia/Yekaterinburg"},{"value":"Asia/Yerevan","name":"Єреван","id":"Asia/Yerevan"},{"value":"Atlantic/Azores","name":"Азорські Острови","id":"Atlantic/Azores"},{"value":"Atlantic/Bermuda","name":"Бермуди","id":"Atlantic/Bermuda"},{"value":"Atlantic/Canary","name":"Канарські Острови","id":"Atlantic/Canary"},{"value":"Atlantic/Cape_Verde","name":"Кабо-Верде","id":"Atlantic/Cape_Verde"},{"value":"Atlantic/Faeroe","name":"Фарерські Острови","id":"Atlantic/Faeroe"},{"value":"Atlantic/Madeira","name":"Мадейра","id":"Atlantic/Madeira"},{"value":"Atlantic/Reykjavik","name":"Рейкʼявік","id":"Atlantic/Reykjavik"},{"value":"Atlantic/South_Georgia","name":"Південна Джорджія","id":"Atlantic/South_Georgia"},{"value":"Atlantic/St_Helena","name":"Острів Святої Єлени","id":"Atlantic/St_Helena"},{"value":"Atlantic/Stanley","name":"Стенлі","id":"Atlantic/Stanley"},{"value":"Australia/Adelaide","name":"Аделаїда","id":"Australia/Adelaide"},{"value":"Australia/Brisbane","name":"Брісбен","id":"Australia/Brisbane"},{"value":"Australia/Broken_Hill","name":"Брокен-Хілл","id":"Australia/Broken_Hill"},{"value":"Australia/Currie","name":"Каррі","id":"Australia/Currie"},{"value":"Australia/Darwin","name":"Дарвін","id":"Australia/Darwin"},{"value":"Australia/Eucla","name":"Евкла","id":"Australia/Eucla"},{"value":"Australia/Hobart","name":"Гобарт","id":"Australia/Hobart"},{"value":"Australia/Lindeman","name":"Ліндеман","id":"Australia/Lindeman"},{"value":"Australia/Lord_Howe","name":"Лорд-Хау","id":"Australia/Lord_Howe"},{"value":"Australia/Melbourne","name":"Мельбурн","id":"Australia/Melbourne"},{"value":"Australia/Perth","name":"Перт","id":"Australia/Perth"},{"value":"Australia/Sydney","name":"Сідней","id":"Australia/Sydney"},{"value":"Etc/UTC","name":"за всесвітнім координованим часом","id":"Etc/UTC"},{"value":"Europe/Amsterdam","name":"Амстердам","id":"Europe/Amsterdam"},{"value":"Europe/Andorra","name":"Андорра","id":"Europe/Andorra"},{"value":"Europe/Astrakhan","name":"Астрахань","id":"Europe/Astrakhan"},{"value":"Europe/Athens","name":"Афіни","id":"Europe/Athens"},{"value":"Europe/Belgrade","name":"Белґрад","id":"Europe/Belgrade"},{"value":"Europe/Berlin","name":"Берлін","id":"Europe/Berlin"},{"value":"Europe/Bratislava","name":"Братислава","id":"Europe/Bratislava"},{"value":"Europe/Brussels","name":"Брюссель","id":"Europe/Brussels"},{"value":"Europe/Bucharest","name":"Бухарест","id":"Europe/Bucharest"},{"value":"Europe/Budapest","name":"Будапешт","id":"Europe/Budapest"},{"value":"Europe/Busingen","name":"Бюзінген","id":"Europe/Busingen"},{"value":"Europe/Chisinau","name":"Кишинів","id":"Europe/Chisinau"},{"value":"Europe/Copenhagen","name":"Копенгаґен","id":"Europe/Copenhagen"},{"value":"Europe/Dublin","name":"за літнім часом в ІрландіїДублін","id":"Europe/Dublin"},{"value":"Europe/Gibraltar","name":"Ґібралтар","id":"Europe/Gibraltar"},{"value":"Europe/Guernsey","name":"Ґернсі","id":"Europe/Guernsey"},{"value":"Europe/Helsinki","name":"Гельсінкі","id":"Europe/Helsinki"},{"value":"Europe/Isle_of_Man","name":"Острів Мен","id":"Europe/Isle_of_Man"},{"value":"Europe/Istanbul","name":"Стамбул","id":"Europe/Istanbul"},{"value":"Europe/Jersey","name":"Джерсі","id":"Europe/Jersey"},{"value":"Europe/Kaliningrad","name":"Калінінград","id":"Europe/Kaliningrad"},{"value":"Europe/Kiev","name":"Київ","id":"Europe/Kiev"},{"value":"Europe/Kirov","name":"Кіров","id":"Europe/Kirov"},{"value":"Europe/Lisbon","name":"Лісабон","id":"Europe/Lisbon"},{"value":"Europe/Ljubljana","name":"Любляна","id":"Europe/Ljubljana"},{"value":"Europe/London","name":"за літнім часом у Великій БританіїЛондон","id":"Europe/London"},{"value":"Europe/Luxembourg","name":"Люксембурґ","id":"Europe/Luxembourg"},{"value":"Europe/Madrid","name":"Мадрид","id":"Europe/Madrid"},{"value":"Europe/Malta","name":"Мальта","id":"Europe/Malta"},{"value":"Europe/Mariehamn","name":"Марієгамн","id":"Europe/Mariehamn"},{"value":"Europe/Minsk","name":"Мінськ","id":"Europe/Minsk"},{"value":"Europe/Monaco","name":"Монако","id":"Europe/Monaco"},{"value":"Europe/Moscow","name":"Москва","id":"Europe/Moscow"},{"value":"Europe/Oslo","name":"Осло","id":"Europe/Oslo"},{"value":"Europe/Paris","name":"Париж","id":"Europe/Paris"},{"value":"Europe/Podgorica","name":"Подгориця","id":"Europe/Podgorica"},{"value":"Europe/Prague","name":"Прага","id":"Europe/Prague"},{"value":"Europe/Riga","name":"Рига","id":"Europe/Riga"},{"value":"Europe/Rome","name":"Рим","id":"Europe/Rome"},{"value":"Europe/Samara","name":"Самара","id":"Europe/Samara"},{"value":"Europe/San_Marino","name":"Сан-Маріно","id":"Europe/San_Marino"},{"value":"Europe/Sarajevo","name":"Сараєво","id":"Europe/Sarajevo"},{"value":"Europe/Saratov","name":"Саратов","id":"Europe/Saratov"},{"value":"Europe/Simferopol","name":"Сімферополь","id":"Europe/Simferopol"},{"value":"Europe/Skopje","name":"Скопʼє","id":"Europe/Skopje"},{"value":"Europe/Sofia","name":"Софія","id":"Europe/Sofia"},{"value":"Europe/Stockholm","name":"Стокгольм","id":"Europe/Stockholm"},{"value":"Europe/Tallinn","name":"Таллінн","id":"Europe/Tallinn"},{"value":"Europe/Tirane","name":"Тирана","id":"Europe/Tirane"},{"value":"Europe/Ulyanovsk","name":"Ульяновськ","id":"Europe/Ulyanovsk"},{"value":"Europe/Uzhgorod","name":"Ужгород","id":"Europe/Uzhgorod"},{"value":"Europe/Vaduz","name":"Вадуц","id":"Europe/Vaduz"},{"value":"Europe/Vatican","name":"Ватикан","id":"Europe/Vatican"},{"value":"Europe/Vienna","name":"Відень","id":"Europe/Vienna"},{"value":"Europe/Vilnius","name":"Вільнюс","id":"Europe/Vilnius"},{"value":"Europe/Volgograd","name":"Волгоград","id":"Europe/Volgograd"},{"value":"Europe/Warsaw","name":"Варшава","id":"Europe/Warsaw"},{"value":"Europe/Zagreb","name":"Заґреб","id":"Europe/Zagreb"},{"value":"Europe/Zaporozhye","name":"Запоріжжя","id":"Europe/Zaporozhye"},{"value":"Europe/Zurich","name":"Цюріх","id":"Europe/Zurich"},{"value":"Indian/Antananarivo","name":"Антананаріву","id":"Indian/Antananarivo"},{"value":"Indian/Chagos","name":"Чаґос","id":"Indian/Chagos"},{"value":"Indian/Christmas","name":"Острів Різдва","id":"Indian/Christmas"},{"value":"Indian/Cocos","name":"Кокосові Острови","id":"Indian/Cocos"},{"value":"Indian/Comoro","name":"Комори","id":"Indian/Comoro"},{"value":"Indian/Kerguelen","name":"Керґелен","id":"Indian/Kerguelen"},{"value":"Indian/Mahe","name":"Махе","id":"Indian/Mahe"},{"value":"Indian/Maldives","name":"Мальдіви","id":"Indian/Maldives"},{"value":"Indian/Mauritius","name":"Маврікій","id":"Indian/Mauritius"},{"value":"Indian/Mayotte","name":"Майотта","id":"Indian/Mayotte"},{"value":"Indian/Reunion","name":"Реюньйон","id":"Indian/Reunion"},{"value":"Pacific/Apia","name":"Апіа","id":"Pacific/Apia"},{"value":"Pacific/Auckland","name":"Окленд","id":"Pacific/Auckland"},{"value":"Pacific/Bougainville","name":"Буґенвіль","id":"Pacific/Bougainville"},{"value":"Pacific/Chatham","name":"Чатем","id":"Pacific/Chatham"},{"value":"Pacific/Easter","name":"Острів Пасхи","id":"Pacific/Easter"},{"value":"Pacific/Efate","name":"Ефате","id":"Pacific/Efate"},{"value":"Pacific/Enderbury","name":"Ендербері","id":"Pacific/Enderbury"},{"value":"Pacific/Fakaofo","name":"Факаофо","id":"Pacific/Fakaofo"},{"value":"Pacific/Fiji","name":"Фіджі","id":"Pacific/Fiji"},{"value":"Pacific/Funafuti","name":"Фунафуті","id":"Pacific/Funafuti"},{"value":"Pacific/Galapagos","name":"Ґалапаґос","id":"Pacific/Galapagos"},{"value":"Pacific/Gambier","name":"Ґамбʼєр","id":"Pacific/Gambier"},{"value":"Pacific/Guadalcanal","name":"Ґуадалканал","id":"Pacific/Guadalcanal"},{"value":"Pacific/Guam","name":"Ґуам","id":"Pacific/Guam"},{"value":"Pacific/Honolulu","name":"Гонолулу","id":"Pacific/Honolulu"},{"value":"Pacific/Johnston","name":"Джонстон","id":"Pacific/Johnston"},{"value":"Pacific/Kiritimati","name":"Кірітіматі","id":"Pacific/Kiritimati"},{"value":"Pacific/Kosrae","name":"Косрае","id":"Pacific/Kosrae"},{"value":"Pacific/Kwajalein","name":"Кваджалейн","id":"Pacific/Kwajalein"},{"value":"Pacific/Majuro","name":"Маджуро","id":"Pacific/Majuro"},{"value":"Pacific/Marquesas","name":"Маркізькі острови","id":"Pacific/Marquesas"},{"value":"Pacific/Midway","name":"Мідвей","id":"Pacific/Midway"},{"value":"Pacific/Nauru","name":"Науру","id":"Pacific/Nauru"},{"value":"Pacific/Niue","name":"Ніуе","id":"Pacific/Niue"},{"value":"Pacific/Norfolk","name":"Норфолк","id":"Pacific/Norfolk"},{"value":"Pacific/Noumea","name":"Нумеа","id":"Pacific/Noumea"},{"value":"Pacific/Pago_Pago","name":"Паго-Паго","id":"Pacific/Pago_Pago"},{"value":"Pacific/Palau","name":"Палау","id":"Pacific/Palau"},{"value":"Pacific/Pitcairn","name":"Піткерн","id":"Pacific/Pitcairn"},{"value":"Pacific/Ponape","name":"Понапе","id":"Pacific/Ponape"},{"value":"Pacific/Port_Moresby","name":"Порт-Морсбі","id":"Pacific/Port_Moresby"},{"value":"Pacific/Rarotonga","name":"Раротонґа","id":"Pacific/Rarotonga"},{"value":"Pacific/Saipan","name":"Сайпан","id":"Pacific/Saipan"},{"value":"Pacific/Tahiti","name":"Таїті","id":"Pacific/Tahiti"},{"value":"Pacific/Tarawa","name":"Тарава","id":"Pacific/Tarawa"},{"value":"Pacific/Tongatapu","name":"Тонґатапу","id":"Pacific/Tongatapu"},{"value":"Pacific/Truk","name":"Чуук","id":"Pacific/Truk"},{"value":"Pacific/Wake","name":"Вейк","id":"Pacific/Wake"},{"value":"Pacific/Wallis","name":"Уолліс","id":"Pacific/Wallis"}];
};

return moment;
})));

moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM YYYY'); };
moment.fn.longDate = function(){ return this.format('D MMMM YYYY LT'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
